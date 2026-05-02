import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('user_id');

    if (!userIdCookie) {
        redirect('/');
    }

    return <DashboardClient userId={parseInt(userIdCookie.value)} />;
}
