import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.37:5100'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    checkLoginStatus()
  }, [])

  const checkLoginStatus = () => {
    const token = localStorage.getItem('userToken')
    if (token) {
      setIsLoggedIn(true)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      alert('Por favor ingresa email y contraseña')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: email.trim(),
        password: password.trim()
      })

      if (response.data.token) {
        localStorage.setItem('userToken', response.data.token)
        localStorage.setItem('userData', JSON.stringify(response.data.user))
        setIsLoggedIn(true)
        setEmail('')
        setPassword('')
      }
    } catch (error) {
      console.error('Login error:', error)
      alert(error.response?.data?.error || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('userToken')
    localStorage.removeItem('userData')
    setIsLoggedIn(false)
  }

  const handleOptionClick = (option) => {
    alert(`Has seleccionado: ${option}`)
    // Aquí puedes agregar lógica adicional
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      setShowCamera(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('No se pudo acceder a la cámara')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL('image/jpeg')
    setCapturedImage(imageData)
    stopCamera()
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  if (showCamera) {
    return (
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline className="camera-view" />
        <div className="camera-controls">
          <button onClick={capturePhoto} className="capture-btn">
            📸 Capturar
          </button>
          <button onClick={stopCamera} className="cancel-btn">
            ✖ Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (isLoggedIn) {
    return (
      <div className="container">
        <h1>Bienvenido</h1>

        {capturedImage && (
          <div className="captured-image">
            <img src={capturedImage} alt="Captura" />
            <button onClick={() => setCapturedImage(null)}>Eliminar foto</button>
          </div>
        )}

        <div className="button-container">
          <button
            className="option-btn efectivo"
            onClick={() => handleOptionClick('Efectivo')}
          >
            💵 Efectivo
          </button>

          <button
            className="option-btn tarjeta"
            onClick={() => handleOptionClick('Tarjeta')}
          >
            💳 Tarjeta
          </button>

          <button
            className="option-btn camera"
            onClick={startCamera}
          >
            📷 Tomar Foto
          </button>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          Cerrar Sesión
        </button>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Iniciar Sesión</h1>

      <form onSubmit={handleLogin} className="login-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input"
        />

        <button
          type="submit"
          disabled={loading}
          className="login-btn"
        >
          {loading ? 'Iniciando...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  )
}

export default App
