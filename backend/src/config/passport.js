const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔍 Google OAuth - Profile received:', {
          id: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName
        });

        const email = profile.emails[0].value;
        const googleId = profile.id;

        // Buscar usuario por googleId o email
        let user = await prisma.users.findFirst({
          where: {
            OR: [
              { googleId: googleId },
              { email: email }
            ]
          },
          include: {
            profiles: true,
            tenant: true
          }
        });

        if (user) {
          // Si el usuario existe pero no tiene googleId, actualizarlo
          if (!user.googleId) {
            user = await prisma.users.update({
              where: { id: user.id },
              data: { googleId: googleId },
              include: {
                profiles: true,
                tenant: true
              }
            });
            console.log('✅ Usuario existente vinculado con Google:', user.email);
          } else {
            console.log('✅ Usuario existente con Google OAuth:', user.email);
          }
        } else {
          // Crear nuevo usuario - necesita un tenant por defecto
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';

          // Buscar el primer tenant disponible para asignar por defecto
          const defaultTenant = await prisma.tenants.findFirst({
            where: { activo: true }
          });

          if (!defaultTenant) {
            console.error('❌ No hay tenants disponibles para asignar al nuevo usuario');
            return done(new Error('No hay tenants disponibles. Contacte al administrador.'), null);
          }

          user = await prisma.users.create({
            data: {
              email: email,
              googleId: googleId,
              nombre: firstName,
              apellido: lastName,
              emailVerified: true, // Google ya verificó el email
              activo: true,
              superuser: false,
              esUsuarioTesoreria: false,
              tenantId: defaultTenant.id
            },
            include: {
              profiles: true,
              tenant: true
            }
          });

          console.log('✅ Nuevo usuario creado con Google OAuth:', user.email);
          console.log('🏢 Tenant asignado:', defaultTenant.nombre);
        }

        return done(null, user);
      } catch (error) {
        console.error('❌ Error en Google OAuth Strategy:', error);
        return done(error, null);
      }
    }
  )
);

// Serialización no necesaria para JWT, pero la incluimos por compatibilidad
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        profiles: true,
        tenant: true
      }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
