import { useEffect, useState } from 'react'

function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((body) => setUser(body.user))
      .catch(() => setUser(null))
  }, [])

  return (
    <div className="container">
      <h1>Tablebook React</h1>
      {user === undefined && <p>Բեռնվում է…</p>}
      {user === null && <p>Մուտք գործած չեք</p>}
      {user && <p>Բարև, {user.first_name}</p>}
    </div>
  )
}

export default App