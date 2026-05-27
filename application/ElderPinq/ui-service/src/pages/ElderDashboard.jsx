import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Pill, HeartPulse, LogOut, Clock, User, Smile, Users, Activity } from 'lucide-react';
import { getCachedUser, logout, getLinkedFamily } from '../api/authApi';
import { checkIn, logVitals } from '../api/healthApi';
import { getReminders, markTaken } from '../api/reminderApi';

export default function ElderDashboard() {
  const navigate = useNavigate();
  const user = getCachedUser();

  const [reminders, setReminders]         = useState([]);
  const [linkedFamily, setLinkedFamily]   = useState([]);
  const [checkedIn, setCheckedIn]         = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [vitalsLoading, setVitalsLoading]   = useState(false);
  const [medLoading, setMedLoading]       = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType]       = useState('success');
  const [time, setTime]                   = useState(new Date());
  
  // Vitals form
  const [vitalsForm, setVitalsForm] = useState({ heartRate: '', bloodPressure: '' });
  const [remindersError, setRemindersError] = useState('');

  // Redirect if not logged in or wrong role
  useEffect(() => {
    if (!user || user.role !== 'elder') {
      navigate('/login', { replace: true });
    }
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load reminders and linked family on mount
  useEffect(() => {
    if (!user?.id) return;
    
    getReminders(user.id)
      .then(setReminders)
      .catch((err) => setRemindersError(err.message));
      
    getLinkedFamily()
      .then(setLinkedFamily)
      .catch(console.error);
  }, [user?.id]);

  const showStatus = (msg, type = 'success') => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => setStatusMessage(''), 4500);
  };

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    try {
      await checkIn(user.id, 'feeling_well');
      setCheckedIn(true);
      showStatus('✅ Check-in recorded! Your family has been notified.', 'success');
    } catch (err) {
      showStatus(`⚠️ ${err.message}`, 'error');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleLogVitals = async (e) => {
    e.preventDefault();
    if (!vitalsForm.heartRate || !vitalsForm.bloodPressure) return;
    setVitalsLoading(true);
    try {
      await logVitals(user.id, parseInt(vitalsForm.heartRate), vitalsForm.bloodPressure);
      setVitalsForm({ heartRate: '', bloodPressure: '' });
      showStatus('💓 Vitals successfully recorded!', 'success');
    } catch (err) {
      showStatus(`⚠️ ${err.message}`, 'error');
    } finally {
      setVitalsLoading(false);
    }
  };

  const handleMedTaken = async (reminder) => {
    setMedLoading(reminder.id);
    try {
      await markTaken(reminder.id);
      setReminders((prev) =>
        prev.map((r) => (r.id === reminder.id ? { ...r, taken: true } : r))
      );
      showStatus(`💊 "${reminder.medication_name}" marked as taken!`, 'success');
    } catch (err) {
      showStatus(`⚠️ ${err.message}`, 'error');
    } finally {
      setMedLoading(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-pink-50 font-sans pb-10">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 text-white px-6 py-5 flex items-center justify-between shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-indigo-500"></div>
        <div className="flex items-center gap-3 relative z-10">
          <HeartPulse className="w-10 h-10 text-pink-400" />
          <span className="text-3xl font-extrabold tracking-tight drop-shadow-md">ElderPing</span>
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-bold tracking-tight">{timeStr}</p>
            <p className="text-indigo-200 text-sm font-medium">{dateStr}</p>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-xl text-lg font-semibold transition-all shadow-md hover:shadow-lg border border-white/20"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] shadow-xl p-8 mb-8 flex items-center justify-between border border-white/60">
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-indigo-600 font-bold uppercase tracking-widest text-sm mb-1">Welcome Back</p>
              <h1 className="text-4xl font-extrabold text-gray-900 drop-shadow-sm capitalize">{user?.username || 'Friend'}</h1>
              {user?.invite_code && (
                <div className="mt-2 inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <span className="text-xs font-bold text-indigo-500 uppercase">Invite Code:</span>
                  <span className="text-sm font-mono font-extrabold text-indigo-800 tracking-wider">{user.invite_code}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="hidden md:flex flex-col items-end">
            <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" /> Monitored By
            </p>
            <div className="flex -space-x-2">
              {linkedFamily.length > 0 ? (
                linkedFamily.map((f, i) => (
                  <div key={f.id} className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white flex items-center justify-center text-white font-bold shadow-md z-10" style={{ zIndex: 10 - i }} title={f.username}>
                    {f.username.charAt(0).toUpperCase()}
                  </div>
                ))
              ) : (
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {statusMessage && (
          <div className={`mb-6 rounded-2xl p-5 text-xl font-semibold text-center ${
            statusType === 'success'
              ? 'bg-green-100 text-green-800 border-2 border-green-400'
              : 'bg-red-100 text-red-800 border-2 border-red-400'
          }`}>
            {statusMessage}
          </div>
        )}

        {/* BIG Check-In Button & Vitals Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="transform transition-all hover:scale-[1.02] h-full">
            <button
              id="checkin-btn"
              onClick={handleCheckIn}
              disabled={checkedIn || checkInLoading}
              className={`w-full h-full py-12 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-2xl text-white text-3xl font-extrabold transition-all border border-white/20 relative overflow-hidden ${
                checkedIn
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 cursor-default shadow-green-500/30'
                  : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 hover:shadow-indigo-500/40 active:scale-95'
              }`}
            >
              {/* Decorative background element */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
              
              {checkInLoading ? (
                <span className="animate-spin w-16 h-16 border-4 border-white/30 border-t-white rounded-full" />
              ) : (
                <CheckCircle2 className="w-20 h-20 drop-shadow-md" strokeWidth={2} />
              )}
              <span className="drop-shadow-md">{checkedIn ? 'Checked In! ✓' : checkInLoading ? 'Sending…' : "I'm Doing Well"}</span>
              <span className="text-lg font-medium opacity-90 tracking-wide drop-shadow-sm text-center px-4">
                {checkedIn
                  ? 'Your family knows you are safe.'
                  : 'Tap to let your family know'}
              </span>
            </button>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-8 border border-white/60 h-full flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Activity className="w-7 h-7 text-pink-500" /> Log Vitals
            </h2>
            <form onSubmit={handleLogVitals} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Heart Rate (bpm)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 72" 
                  value={vitalsForm.heartRate} 
                  onChange={e => setVitalsForm({...vitalsForm, heartRate: e.target.value})} 
                  className="w-full bg-gray-50 border-2 border-indigo-100 rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-400 transition-colors" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Blood Pressure</label>
                <input 
                  type="text" 
                  placeholder="e.g. 120/80" 
                  value={vitalsForm.bloodPressure} 
                  onChange={e => setVitalsForm({...vitalsForm, bloodPressure: e.target.value})} 
                  pattern="\d{2,3}/\d{2,3}"
                  title="Please enter blood pressure in the format SYS/DIA (e.g., 120/80)"
                  className="w-full bg-gray-50 border-2 border-indigo-100 rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-400 transition-colors" 
                  required 
                />
              </div>
              <button 
                type="submit" 
                disabled={vitalsLoading}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xl py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-2"
              >
                {vitalsLoading ? 'Saving...' : 'Save Vitals'}
              </button>
            </form>
          </div>
        </div>

        {/* Medications */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl overflow-hidden border border-white/60">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <Pill className="w-10 h-10 text-white/90 drop-shadow-sm" />
            <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">Today's Medications</h2>
          </div>

          {remindersError ? (
            <p className="text-center text-red-500 py-8 text-lg">{remindersError}</p>
          ) : reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <Smile className="w-14 h-14" />
              <p className="text-xl">No medications scheduled.</p>
            </div>
          ) : (
            <ul className="divide-y-2 divide-gray-100">
              {reminders.map((r) => (
                <li key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-8 py-6 gap-6 hover:bg-indigo-50/50 transition-colors">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl shadow-inner ${r.taken ? 'bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200' : 'bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200'}`}>
                      <Pill className={`w-8 h-8 ${r.taken ? 'text-green-600' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-gray-800 tracking-tight">{r.medication_name}</p>
                      <p className="text-indigo-600 font-semibold text-lg mt-1">{r.dosage} &bull; {r.time_of_day?.slice(0, 5)}</p>
                    </div>
                  </div>
                  <button
                    id={`med-taken-${r.id}`}
                    onClick={() => !r.taken && handleMedTaken(r)}
                    disabled={r.taken || medLoading === r.id}
                    className={`w-full sm:w-auto px-8 py-4 rounded-xl text-xl font-bold transition-all shadow-md active:scale-95 whitespace-nowrap ${
                      r.taken
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 cursor-default border border-green-200'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/30 hover:shadow-indigo-500/50'
                    }`}
                  >
                    {medLoading === r.id ? '…' : r.taken ? '✓ Taken' : 'Mark Taken'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 text-gray-500 justify-center">
          <Clock className="w-5 h-5" />
          <span className="text-base">Last updated: {timeStr}</span>
        </div>
      </main>
    </div>
  );
}
