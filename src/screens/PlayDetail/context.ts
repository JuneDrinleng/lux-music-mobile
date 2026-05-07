import { createContext, useContext } from 'react'

export const PlayDetailContext = createContext<() => void>(() => {})

export const usePlayDetailClose = () => useContext(PlayDetailContext)
