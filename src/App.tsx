import { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google"
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div style={{padding:40,fontSize:20}}>
        Carregando...
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{padding:40}}>
        <h2>Login</h2>
        <button onClick={loginWithGoogle}>
          Entrar com Google
        </button>
      </div>
    )
  }

  return (
    <div style={{padding:40}}>
      <h2>Logado</h2>
      <p>{user.email}</p>

      <button onClick={logout}>
        Sair
      </button>
    </div>
  )
}
