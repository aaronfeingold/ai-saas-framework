import { createContentType } from './queries';
import { festivalContentTypes } from './types';
import type { ContentType } from './types';

/**
 * Initialize the festival/events domain content types
 * This demonstrates how to set up a complete domain-specific content system
 */
export async function initializeFestivalDomain(userId: string): Promise<{
  event: ContentType;
  venue: ContentType;
  artist: ContentType;
}> {
  // Create content types in dependency order (venues and artists first, then events)
  const venue = await createContentType(
    { ...festivalContentTypes[1], created_by: userId },
    userId
  );

  const artist = await createContentType(
    { ...festivalContentTypes[2], created_by: userId },
    userId
  );

  // Update event content type to reference the created venue and artist content types
  const eventContentType = {
    ...festivalContentTypes[0],
    created_by: userId,
  };

  // Update relation field references to actual content type IDs
  const venueField = eventContentType.fields.find((f) => f.name === 'venue');
  if (venueField) {
    venueField.validation.relation_to = venue.id;
  }

  const artistsField = eventContentType.fields.find(
    (f) => f.name === 'artists'
  );
  if (artistsField) {
    artistsField.validation.relation_to = artist.id;
  }

  const event = await createContentType(eventContentType, userId);

  return { event, venue, artist };
}

/**
 * Create sample festival content for demonstration
 */
export async function createSampleFestivalContent(
  contentTypes: { event: ContentType; venue: ContentType; artist: ContentType },
  userId: string
) {
  const { createContent } = await import('./queries');

  // Create sample venues
  const venue1 = await createContent(
    contentTypes.venue.id,
    {
      data: {
        name: 'Main Stage Arena',
        description:
          'Our largest outdoor venue with state-of-the-art sound and lighting',
        address: '123 Festival Grounds\nMusic City, MC 12345',
        capacity: 15000,
        amenities: [
          'Sound System',
          'Lighting',
          'VIP Area',
          'Bar',
          'Food Court',
        ],
        website: 'https://example.com/main-stage',
      },
      status: 'published',
    },
    userId
  );

  const venue2 = await createContent(
    contentTypes.venue.id,
    {
      data: {
        name: 'Acoustic Lounge',
        description: 'Intimate indoor venue perfect for acoustic performances',
        address: '456 Cozy Corner\nMusic City, MC 12345',
        capacity: 500,
        amenities: ['Sound System', 'Backstage', 'Bar'],
        website: 'https://example.com/acoustic-lounge',
      },
      status: 'published',
    },
    userId
  );

  // Create sample artists
  const artist1 = await createContent(
    contentTypes.artist.id,
    {
      data: {
        name: 'The Electric Waves',
        bio: 'High-energy electronic music duo known for their innovative sound and captivating live performances.',
        genre: 'Electronic',
        website: 'https://electricwaves.music',
        social_links: {
          instagram: '@electricwaves',
          twitter: '@electricwaves_official',
          spotify: 'https://spotify.com/artist/electricwaves',
        },
      },
      status: 'published',
    },
    userId
  );

  const artist2 = await createContent(
    contentTypes.artist.id,
    {
      data: {
        name: 'Sarah Moonlight',
        bio: 'Singer-songwriter with a voice that touches the soul. Her acoustic melodies tell stories of love, loss, and hope.',
        genre: 'Folk',
        website: 'https://sarahmoonlight.com',
        social_links: {
          instagram: '@sarah_moonlight',
          twitter: '@sarahmoon',
          youtube: 'https://youtube.com/sarahmoonlight',
        },
      },
      status: 'published',
    },
    userId
  );

  const artist3 = await createContent(
    contentTypes.artist.id,
    {
      data: {
        name: 'Rhythm & Blues Collective',
        bio: 'A talented group of musicians bringing classic R&B sounds to the modern stage.',
        genre: 'Jazz',
        website: 'https://rbnbcollective.com',
        social_links: {
          facebook: 'https://facebook.com/rbnbcollective',
          instagram: '@rbnb_collective',
        },
      },
      status: 'published',
    },
    userId
  );

  // Create sample events
  const event1 = await createContent(
    contentTypes.event.id,
    {
      data: {
        title: 'Electric Summer Nights',
        description:
          'Join us for an unforgettable evening of electronic music under the stars. The Electric Waves will take you on a sonic journey that will keep you dancing all night long.',
        start_datetime: new Date('2024-07-15T20:00:00Z'),
        end_datetime: new Date('2024-07-15T23:30:00Z'),
        venue: venue1.id,
        artists: [artist1.id],
        ticket_price: 75,
        capacity: 12000,
      },
      metadata: {
        featured: true,
        tags: ['electronic', 'dance', 'summer'],
        seo_title: 'Electric Summer Nights - Main Stage Arena',
        seo_description:
          'Experience the best electronic music at our summer festival.',
      },
      status: 'published',
    },
    userId
  );

  const event2 = await createContent(
    contentTypes.event.id,
    {
      data: {
        title: 'Acoustic Storytelling Night',
        description:
          'An intimate evening of acoustic music and storytelling. Sarah Moonlight will perform her latest songs in our cozy acoustic lounge.',
        start_datetime: new Date('2024-07-20T19:00:00Z'),
        end_datetime: new Date('2024-07-20T22:00:00Z'),
        venue: venue2.id,
        artists: [artist2.id],
        ticket_price: 35,
        capacity: 450,
      },
      metadata: {
        featured: false,
        tags: ['acoustic', 'folk', 'intimate'],
        seo_title: 'Acoustic Storytelling Night with Sarah Moonlight',
        seo_description:
          'Join Sarah Moonlight for an intimate acoustic performance.',
      },
      status: 'published',
    },
    userId
  );

  const event3 = await createContent(
    contentTypes.event.id,
    {
      data: {
        title: 'Jazz & Soul Festival Finale',
        description:
          'Close out the festival with the smooth sounds of jazz and soul. Multiple artists will take the stage for an unforgettable finale.',
        start_datetime: new Date('2024-07-25T18:00:00Z'),
        end_datetime: new Date('2024-07-26T01:00:00Z'),
        venue: venue1.id,
        artists: [artist3.id, artist2.id], // Multiple artists
        ticket_price: 95,
        capacity: 15000,
      },
      metadata: {
        featured: true,
        tags: ['jazz', 'soul', 'finale', 'multiple-artists'],
        seo_title: 'Jazz & Soul Festival Finale - Multi-Artist Event',
        seo_description:
          'The grand finale featuring multiple talented artists.',
      },
      status: 'published',
    },
    userId
  );

  return {
    venues: [venue1, venue2],
    artists: [artist1, artist2, artist3],
    events: [event1, event2, event3],
  };
}

/**
 * Get festival domain statistics
 */
export async function getFestivalStats(userId: string) {
  const { getContents, getContentTypes } = await import('./queries');

  const contentTypes = await getContentTypes(userId);
  const eventType = contentTypes.find((ct) => ct.slug === 'event');
  const venueType = contentTypes.find((ct) => ct.slug === 'venue');
  const artistType = contentTypes.find((ct) => ct.slug === 'artist');

  const stats = {
    content_types: contentTypes.length,
    events: 0,
    venues: 0,
    artists: 0,
    published_events: 0,
  };

  if (eventType) {
    const events = await getContents({
      content_type_id: eventType.id,
      limit: 100,
      offset: 0,
    });
    stats.events = events.total;

    const publishedEvents = await getContents({
      content_type_id: eventType.id,
      status: 'published',
      limit: 100,
      offset: 0,
    });
    stats.published_events = publishedEvents.total;
  }

  if (venueType) {
    const venues = await getContents({
      content_type_id: venueType.id,
      limit: 100,
      offset: 0,
    });
    stats.venues = venues.total;
  }

  if (artistType) {
    const artists = await getContents({
      content_type_id: artistType.id,
      limit: 100,
      offset: 0,
    });
    stats.artists = artists.total;
  }

  return stats;
}

/**
 * Domain-specific queries for the festival use case
 */
export class FestivalQueries {
  constructor(private userId: string) {}

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit = 10) {
    const { getContents, getContentTypeBySlug } = await import('./queries');

    const eventType = await getContentTypeBySlug('event');
    if (!eventType) return { contents: [], total: 0 };

    return getContents({
      content_type_id: eventType.id,
      status: 'published',
      date_from: new Date(),
      limit,
      offset: 0,
      sort_by: 'createdAt',
      sort_direction: 'asc',
    });
  }

  /**
   * Get featured events
   */
  async getFeaturedEvents(limit = 5) {
    const { getContents, getContentTypeBySlug } = await import('./queries');

    const eventType = await getContentTypeBySlug('event');
    if (!eventType) return { contents: [], total: 0 };

    return getContents({
      content_type_id: eventType.id,
      status: 'published',
      featured: true,
      limit,
      offset: 0,
    });
  }

  /**
   * Get events by venue
   */
  async getEventsByVenue(venueId: string, limit = 10) {
    const { getContents, getContentTypeBySlug } = await import('./queries');

    const eventType = await getContentTypeBySlug('event');
    if (!eventType) return { contents: [], total: 0 };

    // This would need to be enhanced to search within the data JSONB field
    // For now, this is a simplified version
    return getContents({
      content_type_id: eventType.id,
      status: 'published',
      limit,
      offset: 0,
    });
  }

  /**
   * Get events by artist
   */
  async getEventsByArtist(artistId: string, limit = 10) {
    const { getContents, getContentTypeBySlug } = await import('./queries');

    const eventType = await getContentTypeBySlug('event');
    if (!eventType) return { contents: [], total: 0 };

    // This would need to be enhanced to search within the data JSONB field
    // For now, this is a simplified version
    return getContents({
      content_type_id: eventType.id,
      status: 'published',
      limit,
      offset: 0,
    });
  }

  /**
   * Search events by genre or other criteria
   */
  async searchEvents(query: string, limit = 10) {
    const { getContents, getContentTypeBySlug } = await import('./queries');

    const eventType = await getContentTypeBySlug('event');
    if (!eventType) return { contents: [], total: 0 };

    return getContents({
      content_type_id: eventType.id,
      status: 'published',
      search: query,
      limit,
      offset: 0,
    });
  }
}

/**
 * Example of how other domains could be implemented
 */
export const domainExamples = {
  wine: {
    content_types: ['winery', 'wine', 'tasting', 'region'],
    description: 'Wine industry with wineries, wines, tastings, and regions',
  },
  real_estate: {
    content_types: ['property', 'agent', 'neighborhood', 'listing'],
    description: 'Real estate with properties, agents, and listings',
  },
  education: {
    content_types: ['course', 'instructor', 'module', 'assignment'],
    description: 'Educational platform with courses and instructors',
  },
  restaurant: {
    content_types: ['restaurant', 'menu_item', 'chef', 'review'],
    description: 'Restaurant guide with menus and reviews',
  },
  rock_climbing: {
    content_types: ['route', 'crag', 'climber', 'gear'],
    description: 'Rock climbing with routes, crags, and gear',
  },
};
