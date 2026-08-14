import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Loading from'./components/Loading'
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <BrowserRouter>
     <Routes>
        <Route path='/' element={<Loading/>}></Route>
     </Routes>
     </BrowserRouter>
    </>
  )
}

export default App
