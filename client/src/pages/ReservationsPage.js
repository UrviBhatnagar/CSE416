// src/pages/ReservationsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import ReservationService from '../services/ReservationService';
import ApiService from '../services/api';    
import GoogleMapService from '../services/GoogleMapService';
import EventReservationService from '../services/EventReservationService';
import './ReservationsPage.css';

function ReservationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { spotId: routeSpotId } = useParams();
  const [regularReservations, setRegularReservations] = useState([]);
  const [eventReservations, setEventReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [newReservation, setNewReservation] = useState({
    startTime: '',
    endTime: '',
    totalPrice: 0
  });
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapUrl, setMapUrl] = useState('');
  
  // Pagination and display control
  const [activeTab, setActiveTab] = useState('all'); // all, regular, event
  const [visibleCount, setVisibleCount] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Check if we're coming from the search page with spot info to create a new reservation
  const spotInfo = location.state?.spotInfo;
  const searchedBuilding = location.state?.searchedBuilding;

  useEffect(() => {
    // If we have spotInfo from search page, prepare to create a new reservation
    if (spotInfo || routeSpotId) {
      // Log the spotInfo to see what we're working with
      console.log('Received spot info:', spotInfo);
      console.log('Received building info:', searchedBuilding);
      
      // Set default start time to current time rounded to nearest hour
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1); // Start one hour from now
      
      // Set default end time to 2 hours after start time
      const end = new Date(now);
      end.setHours(end.getHours() + 2);
      
      // Format for datetime-local input
      const formatDateForInput = (date) => {
        return date.toISOString().slice(0, 16);
      };
      let info = spotInfo;
      if (!info && routeSpotId) {
        info = { spotId: routeSpotId };
      }

      // Get spot details from the spotInfo
      let lotId, spotId;
      
      if (info.spotId && typeof info.spotId === 'string' && info.spotId.includes('-')) {
        // If spotId is in format "lotId-spotNum", we need to extract lotId differently
        const [extractedLotId, spotNum] = info.spotId.split('-');
        lotId = extractedLotId;
        spotId = info.spotId; // Keep the full spotId
      } else {
        // Extract from spot details if available
        lotId = info.lot?._id || '';
        spotId = info._id || info.spotId || '';
      }
      
      // Extract building ID if available
      const buildingId = searchedBuilding?._id || null;
      const navStart = location.state?.startTime;
      const navEnd = location.state?.endTime;
      
      setNewReservation({
        lotId: lotId,
        spotId: spotId,
        building: buildingId,
        startTime: navStart || formatDateForInput(now),
        endTime: navEnd || formatDateForInput(end),
        totalPrice: 5.00 // Default price, will be calculated based on duration
      });
      
      console.log('Setting new reservation with:', {
        lotId, spotId, building: buildingId
      });
      
      setShowReservationForm(true);
    }
    
    // Fetch existing reservations
    fetchReservations();
  }, [spotInfo, searchedBuilding, routeSpotId]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      // Fetch both regular and event reservations in parallel
      const [regularData, eventData] = await Promise.all([
        ReservationService.getReservations(),
        EventReservationService.getEventReservations()
      ]);
      
      console.log('Fetched regular reservations:', regularData);
      console.log('Fetched event reservations:', eventData);
      
      setRegularReservations(regularData);
      setEventReservations(eventData);
      setError(null);
    } catch (err) {
      console.error('Error fetching reservations:', err);
      setError('Failed to load your reservations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    (async () => {
      try {
        await ApiService.payment.confirm(sessionId); // add this helper
        await fetchReservations();                   // refresh UI
      } catch (err) {
        console.error('Payment confirm failed', err);
      }
    })();
  }, [sessionId]);

  function formatLocalDateTimeInput(date) {
    // Returns YYYY-MM-DDTHH:mm in local time
    const pad = (n) => n.toString().padStart(2, '0');
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate()) +
      'T' +
      pad(date.getHours()) +
      ':' +
      pad(date.getMinutes())
    );
  }
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    
    if (!newReservation.startTime || !newReservation.endTime) {
      alert('Please select both start and end times.');
      return;
    }
    
    // Validate times
    const startDate = new Date(newReservation.startTime);
    const endDate = new Date(newReservation.endTime);
    const now = new Date();
    
    if (startDate < new Date(now.getTime() + 10 * 60000)) {
      alert('Start time must be at least 10 minutes from now.');
      return;
    }
  
    if (startDate >= endDate) {
      alert('End time must be after start time.');
      return;
    }
    
    // Calculate price based on duration
    const durationHours = (endDate - startDate) / (1000 * 60 * 60);
    const totalPrice = (durationHours * 2.50).toFixed(2); // $2.50 per hour
    
    try {
      // Create the reservation data according to what the server expects
      const reservationData = {
        lotId: newReservation.lotId,
        spotId: newReservation.spotId,
        building: newReservation.building, // optional
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        totalPrice: parseFloat(totalPrice)
      };
      
      console.log('Creating reservation with data:', reservationData);
      
      try {
        const result = await ReservationService.createReservation(reservationData);
        console.log('Reservation created successfully:', result);
        
        // Refresh reservations list and hide form
        fetchReservations();
        setShowReservationForm(false);
        
        // Clear location state to prevent re-creating the same reservation
        navigate('/reservations', { replace: true });
      } catch (error) {
        console.error('Full error details:', error);
        alert(`Failed to create reservation: ${error.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error creating reservation:', err);
      alert(`Failed to create reservation: ${err.message || 'Unknown error'}`);
    }
  };

  const handleCancelReservation = async (id, isEventReservation = false) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }
    
    try {
      if (isEventReservation) {
        await EventReservationService.cancelEventReservation(id);
      } else {
        await ReservationService.cancelReservation(id);
      }
      // Refresh reservations list
      fetchReservations();
    } catch (err) {
      console.error(`Error cancelling ${isEventReservation ? 'event ' : ''}reservation:`, err);
      alert(`Failed to cancel ${isEventReservation ? 'event ' : ''}reservation. Please try again.`);
    }
  };

  const handleViewDirections = (reservation) => {
    if (reservation.spot && reservation.spot.location && reservation.building) {
      const spotCoords = reservation.spot.location.coordinates; // [lon, lat]
      const buildingCentroid = reservation.building.centroid;   // { x, y }
      const origin = `${spotCoords[1]},${spotCoords[0]}`;
      const destination = `${buildingCentroid.y},${buildingCentroid.x}`;
      const embedUrl = GoogleMapService.getDirectionsEmbedUrl(origin, destination, 'walking');
      setMapUrl(embedUrl);
      setShowMapModal(true);
    } else if (reservation.spot && reservation.spot.location) {
      const [lon, lat] = reservation.spot.location.coordinates;
      const embedUrl = GoogleMapService.getDirectionsEmbedUrl(`${lat},${lon}`, `${lat},${lon}`, 'walking');
      setMapUrl(embedUrl);
      setShowMapModal(true);
    }
  };

  const loadMoreReservations = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 5);
      setLoadingMore(false);
    }, 500);
  };
  
  // Format date for display
  const formatDateForDisplay = (dateString) => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };


  // Calculate reservation status
  const getReservationStatus = (reservation) => {
    const now = new Date();
    const startTime = new Date(reservation.startTime);
    const endTime = new Date(reservation.endTime);
    
    if (reservation.status === 'cancelled') {
      return 'cancelled';
    } else if (reservation.status === 'rejected') {
      return 'rejected';
    } else if (reservation.status === 'approved') {
      return 'approved';
    } else if (reservation.status === 'pending' && startTime > now) {
      return 'pending';
    }
    
    if (now < startTime) {
      return 'pending';
    }
    
    if (now >= startTime && now <= endTime) {
      return 'active';
    }
    
    return 'completed';
  };

  // Get all reservations based on active tab and sort them
  const getAllReservations = () => {
    // Add isEventReservation flag to each reservation type
    const processedRegular = regularReservations.map(res => ({
      ...res,
      isEventReservation: false
    }));
    
    const processedEvent = eventReservations.map(res => ({
      ...res,
      isEventReservation: true,
      spotDisplay: res.spots && res.spots.length > 0 ? 
        `${res.spots.length} spots` : 
        'Multiple spots'
    }));
    
    // Filter based on active tab
    let filtered = [];
    if (activeTab === 'all') {
      filtered = [...processedRegular, ...processedEvent];
    } else if (activeTab === 'regular') {
      filtered = processedRegular;
    } else if (activeTab === 'event') {
      filtered = processedEvent;
    }
    
    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Group reservations by status
    const active = filtered.filter(res => getReservationStatus(res) === 'active');
    const pending = filtered.filter(res => getReservationStatus(res) === 'pending');
    const approved = filtered.filter(res => getReservationStatus(res) === 'approved' && getReservationStatus(res) !== 'active');
    const completed = filtered.filter(res => getReservationStatus(res) === 'completed');
    const cancelled = filtered.filter(res => 
      getReservationStatus(res) === 'cancelled' ||
      getReservationStatus(res) === 'rejected'
    );
    
    return {
      all: filtered,
      active,
      pending,
      approved,
      completed,
      cancelled,
      hasReservations: filtered.length > 0
    };
  };

  // Render a group of reservations
  const renderReservationGroup = (title, reservations, icon) => {
    if (!reservations || reservations.length === 0) return null;
    const visibleReservations = reservations.slice(0, visibleCount);
    return (
      <div className="reservation-group">
        <div className="reservation-group-header">
          <h3 className="reservation-group-title">
            {icon}
            {title}
          </h3>
          <span className="reservation-group-count">{reservations.length}</span>
        </div>
        <div className="reservations-list">
          {visibleReservations.map((reservation, index) => renderReservationCard(reservation, index))}
        </div>
        {reservations.length > visibleReservations.length && (
          <div className="load-more-container">
            <button
              className={`load-more-btn ${loadingMore ? 'loading' : ''}`}
              onClick={loadMoreReservations}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <div className="load-more-spinner"></div>
                  Loading more...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                  Load More ({reservations.length - visibleReservations.length} remaining)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderReservationCard = (reservation, index) => {
    const status = getReservationStatus(reservation);
    const isEvent = reservation.isEventReservation;
    return (
      <div key={reservation._id} className={`reservation-card ${isEvent ? 'event-reservation-card' : ''}`}>
        <div className="reservation-header">
          <h3>
            {isEvent
              ? `Event: ${reservation.eventName || 'Unnamed Event'}`
              : `Reservation #${reservation._id.substring(0, 6)}`}
          </h3>
          <span className={`status-badge status-${status}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        <div className="reservation-details">
          <div className="reservation-detail-grid">
            {isEvent ? (
              <div className="reservation-detail">
                <span className="reservation-detail-label">Event Spots</span>
                <span className="reservation-detail-value">
                  {reservation.spots ? reservation.spots.length : 0} spots reserved
                </span>
                {reservation.spots && reservation.spots.length > 0 && (
                  <div className="selected-spots-list">
                    {reservation.spots.slice(0, 5).map((spot, idx) => (
                      <span key={idx} className="selected-spot-badge">
                        {typeof spot === 'string'
                          ? spot.split('-')[1] || spot.substring(0, 8)
                          : spot.spotId
                            ? spot.spotId.split('-')[1] || spot.spotId.substring(0, 8)
                            : `Spot ${idx + 1}`}
                      </span>
                    ))}
                    {reservation.spots.length > 5 && (
                      <span className="selected-spot-badge">
                        +{reservation.spots.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="reservation-detail">
                <span className="reservation-detail-label">Spot ID</span>
                <span className="reservation-detail-value">
                  {reservation.spot?.spotId ||
                    (typeof reservation.spot === 'string' ? reservation.spot.substring(0, 8) : 'N/A')}
                </span>
              </div>
            )}
            <div className="reservation-detail">
              <span className="reservation-detail-label">Parking Lot</span>
              <span className="reservation-detail-value">
                {reservation.lot?.officialLotName ||
                  (typeof reservation.lot === 'string' ? 'Lot ' + reservation.lot.substring(0, 6) : 'N/A')}
              </span>
            </div>
            <div className="reservation-detail">
              <span className="reservation-detail-label">Start Time</span>
              <span className="reservation-detail-value">{formatDateForDisplay(reservation.startTime)}</span>
            </div>
            <div className="reservation-detail">
              <span className="reservation-detail-label">End Time</span>
              <span className="reservation-detail-value">{formatDateForDisplay(reservation.endTime)}</span>
            </div>
            {isEvent && reservation.reason && (
              <div className="reservation-detail full-width">
                <span className="reservation-detail-label">Event Reason</span>
                <span className="reservation-detail-value reason-text">{reservation.reason}</span>
              </div>
            )}
            {isEvent && reservation.adminNotes && (
              <div className="reservation-detail full-width">
                <span className="reservation-detail-label">Admin Notes</span>
                <span className="reservation-detail-value admin-notes">{reservation.adminNotes}</span>
              </div>
            )}
          </div>
          <div className="reservation-payment">
              <div className="payment-status">
                <span className="payment-label">Payment:</span>
                {reservation.paymentStatus === 'paid' ? (
                  <span className="paid-status">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Paid
                  </span>
                ) : (
                  <span className="unpaid-status">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Unpaid
                  </span>
                )}
              </div>
              
              <span className="reservation-detail-value">${reservation.totalPrice.toFixed(2)}</span>
              
              {reservation.paymentStatus === 'unpaid' && (
                <button
                    className="pay-now-btn"
                      onClick={async () => {
                        try {
                          const { url } = reservation.isEventReservation
                           ? await ApiService.payment.createEventReservationCheckoutSession(
                             reservation._id
                             )
                            : await ApiService.payment.createCheckoutSession(reservation._id);
                          window.location.href = url;           // hand-off to Stripe Checkout
                        } catch (err) {
                          console.error(err);
                          alert(err.message || 'Could not start checkout');
                        }
                      }}
                    >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                  Pay Now
                </button>
              )}
          </div>
        </div>
        <div className="reservation-actions">
          <button className="reservation-btn map-btn" onClick={() => handleViewDirections(reservation)}>
            View on Map
          </button>
          {status === 'pending' && (
            <>
              {!isEvent && (
                <button
                  className="reservation-btn modify-btn"
                  onClick={() => navigate(`/modify-reservation/${reservation._id}`)}
                >
                  Modify
                </button>
              )}
              <button
                className="reservation-btn cancel-btn"
                onClick={() => handleCancelReservation(reservation._id, isEvent)}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const groupedReservations = getAllReservations();

  return (
    <div className="premium-reservations-page">
      <div className="premium-header">
        <Header />
      </div>
      <div className="reservations-container">
        <div className="page-header">
          <h1>My Reservations</h1>
          <button className="return-home-btn" onClick={() => navigate('/home')}>
            Return to Home
          </button>
        </div>
        {error && (
          <div className="error-message">{error}</div>
        )}
        {!showReservationForm && !loading && (
          <div className="action-buttons">
            <button className="new-reservation-btn" onClick={() => navigate('/search-parking')}>
              Find Parking to Reserve
            </button>
            <button className="new-event-reservation-btn" onClick={() => navigate('/event-reservation')}>
              Create Event Reservation
            </button>
          </div>
        )}
        {!showReservationForm && !loading && (
          <div className="reservation-tabs">
            <div className={`reservation-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
              All Reservations
            </div>
            <div className={`reservation-tab ${activeTab === 'regular' ? 'active' : ''}`} onClick={() => setActiveTab('regular')}>
              Regular Spots
            </div>
            <div className={`reservation-tab ${activeTab === 'event' ? 'active' : ''}`} onClick={() => setActiveTab('event')}>
              Event Reservations
            </div>
          </div>
        )}
        {showReservationForm && (
          <div className="new-reservation-form">
            <div className="reservation-form-header">
              <h2>Create New Reservation</h2>
            </div>
            <div className="reservation-form-body">
              <form onSubmit={handleCreateReservation}>
                <div className="reservation-form-group">
                  <label className="reservation-form-label" htmlFor="startTime">Start Time:</label>
                  <input
                    className="reservation-form-input"
                    type="datetime-local"
                    id="startTime"
                    value={newReservation.startTime}
                    onChange={(e) => setNewReservation({ ...newReservation, startTime: e.target.value })}
                    min={formatLocalDateTimeInput(new Date())}
                    required
                  />
                </div>
                <div className="reservation-form-group">
                  <label className="reservation-form-label" htmlFor="endTime">End Time:</label>
                  <input
                    className="reservation-form-input"
                    type="datetime-local"
                    id="endTime"
                    value={newReservation.endTime}
                    onChange={(e) => setNewReservation({ ...newReservation, endTime: e.target.value })}
                    min={newReservation.startTime}
                    required
                  />
                </div>
                <div className="reservation-form-footer">
                  <div className="reservation-form-note">
                    <strong>Note:</strong> Price is calculated at $2.50 per hour based on your selected timeframe.
                  </div>
                  <div className="reservation-form-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReservationForm(false);
                        navigate('/reservations', { replace: true });
                      }}
                      className="reservation-form-btn reservation-cancel-btn"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="reservation-form-btn reservation-submit-btn"
                    >
                      Create Reservation
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading your reservations...</p>
          </div>
        ) : groupedReservations.all.length === 0 && !showReservationForm ? (
          <div className="no-reservations">
            <div className="no-reservations-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 15h8"></path>
                <path d="M9 9h.01"></path>
                <path d="M15 9h.01"></path>
              </svg>
            </div>
            <h3>No {activeTab !== 'all' ? (activeTab === 'regular' ? 'Regular' : 'Event') : ''} Reservations Found</h3>
            <p>You don't have any {activeTab !== 'all' ? (activeTab === 'regular' ? 'regular' : 'event') : 'active'} parking reservations at the moment.</p>
          </div>
        ) : (
          !showReservationForm && (
            <div className="reservations-content">
              {renderReservationGroup("Active Reservations", groupedReservations.active, <span>🟢 </span>)}
              {renderReservationGroup("Pending Reservations", groupedReservations.pending, <span>🕒 </span>)}
              {renderReservationGroup("Approved Event Reservations", groupedReservations.approved, <span>✅ </span>)}
              {renderReservationGroup("Completed Reservations", groupedReservations.completed, <span>✔️ </span>)}
              {renderReservationGroup("Cancelled & Rejected Reservations", groupedReservations.cancelled, <span>❌ </span>)}
            </div>
          )
        )}
      </div>
      {showMapModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target.className === "modal-backdrop") setShowMapModal(false);
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: 700,
              width: "95vw",
              padding: 0,
              position: "relative",
            }}
          >
            <button
              className="spot-back-btn"
              onClick={() => setShowMapModal(false)}
            >
              ← Back
            </button>
            <iframe
              src={mapUrl}
              title="Google Maps"
              width="100%"
              height="450"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ReservationsPage;