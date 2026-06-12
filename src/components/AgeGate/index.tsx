import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import { LockClosedIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.AgeGate', {
  title: 'Age Verification Required',
  description:
    'This platform contains adult content. You must be of legal age in your jurisdiction to proceed.',
  enterBirthDate: 'Enter your date of birth to continue',
  month: 'Month',
  day: 'Day',
  year: 'Year',
  continue: 'I am over 18 · Enter',
  notOldEnough: 'You must be at least 18 years old to access this content.',
  invalidDate: 'Please enter a valid date.',
  rememberMe: 'Remember me on this device',
  privacyNote: 'Your birth date is only used for age verification and is not stored.',
  welcome: 'Welcome to Voyeurr',
});

interface AgeGateProps {
  minAge?: number;
  onVerified: () => void;
}

const AgeGate = ({ minAge = 18, onVerified }: AgeGateProps) => {
  const intl = useIntl();
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  const verify = () => {
    const m = parseInt(month);
    const d = parseInt(day);
    const y = parseInt(year);

    if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) {
      setError(intl.formatMessage(messages.invalidDate));
      return;
    }

    const birthDate = new Date(y, m - 1, d);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < minAge) {
      setError(intl.formatMessage(messages.notOldEnough));
      return;
    }

    if (rememberMe) {
      try {
        localStorage.setItem('voyeurr_age_verified', 'true');
        localStorage.setItem('voyeurr_age_verified_at', Date.now().toString());
      } catch {
        // localStorage may be unavailable
      }
    }

    setError('');
    onVerified();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#1a0a1e' }}>
      <div className="w-full max-w-md rounded-xl border p-8 shadow-2xl" style={{ borderColor: '#3a2048', backgroundColor: '#1e1228' }}>
        <div className="mb-6 text-center">
          <LockClosedIcon className="mx-auto h-12 w-12" style={{ color: '#ff3366' }} />
          <h1 className="mt-4 text-2xl font-bold text-white">{intl.formatMessage(messages.title)}</h1>
          <p className="mt-2 text-sm" style={{ color: '#7a6a82' }}>
            {intl.formatMessage(messages.description)}
          </p>
        </div>

        <p className="mb-3 text-sm font-medium" style={{ color: '#d4c8dc' }}>
          {intl.formatMessage(messages.enterBirthDate)}
        </p>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs" style={{ color: '#7a6a82' }}>
              {intl.formatMessage(messages.month)}
            </label>
            <input
              type="number"
              min="1"
              max="12"
              placeholder="MM"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-center text-sm"
              style={{ borderColor: '#3a2048', backgroundColor: '#1a0a1e', color: '#e2d8e8' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: '#7a6a82' }}>
              {intl.formatMessage(messages.day)}
            </label>
            <input
              type="number"
              min="1"
              max="31"
              placeholder="DD"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-center text-sm"
              style={{ borderColor: '#3a2048', backgroundColor: '#1a0a1e', color: '#e2d8e8' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: '#7a6a82' }}>
              {intl.formatMessage(messages.year)}
            </label>
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              placeholder="YYYY"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-center text-sm"
              style={{ borderColor: '#3a2048', backgroundColor: '#1a0a1e', color: '#e2d8e8' }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm" style={{ color: '#7a6a82' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4"
          />
          {intl.formatMessage(messages.rememberMe)}
        </label>

        <Button buttonType="primary" className="w-full" onClick={verify}>
          {intl.formatMessage(messages.continue)}
        </Button>

        <p className="mt-4 text-center text-xs" style={{ color: '#7a6a82' }}>
          {intl.formatMessage(messages.privacyNote)}
        </p>
      </div>
    </div>
  );
};

export default AgeGate;
