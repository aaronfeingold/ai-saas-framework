import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Redirect to profile page as the default settings page
  redirect('/settings/profile');
}
