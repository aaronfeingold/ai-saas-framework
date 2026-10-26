import { getTeamForUser } from '@/lib/db/queries';

export async function GET() {
  try {
    const team = await getTeamForUser();
    return Response.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    return Response.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}
