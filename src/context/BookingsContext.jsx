import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getBookings, getBookingById } from '../services/bookingService'

const BookingsContext = createContext(null)

export function BookingsProvider({ children }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBookings()
      setBookings(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const patchBooking = useCallback((bookingId, changes) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...changes } : b))
  }, [])

  const refreshBooking = useCallback(async (bookingId) => {
    try {
      const updated = await getBookingById(bookingId)
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b))
      return updated
    } catch {
      fetchBookings()
      return null
    }
  }, [fetchBookings])

  const addBooking = useCallback(async (bookingId) => {
    try {
      const newBooking = await getBookingById(bookingId)
      if (newBooking) setBookings(prev => [newBooking, ...prev])
    } catch {
      fetchBookings()
    }
  }, [fetchBookings])

  return (
    <BookingsContext.Provider value={{ bookings, loading, error, refetch: fetchBookings, patchBooking, refreshBooking, addBooking }}>
      {children}
    </BookingsContext.Provider>
  )
}

export function useBookings() {
  return useContext(BookingsContext)
}
