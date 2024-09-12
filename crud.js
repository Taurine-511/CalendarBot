const fs = require('fs').promises;
const { google } = require('googleapis');
const { moment } = require('moment');

// Auth

const getOAuth2Client = async () => {
    const credentialsText = await fs.readFile('credentials.json', 'utf-8');
    const credentials = JSON.parse(credentialsText);

    const tokenText = await fs.readFile('token.json', 'utf-8');
    const token = JSON.parse(tokenText);

    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    oAuth2Client.setCredentials(token);
    return oAuth2Client;
};

// add event
export const addEvent = async (calendarEvent) => {
    console.log('Create Event captured:');
    console.log(calendarEvent);

    const auth = await getOAuth2Client();

    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
        auth,
        calendarId: 'primary',
        resource: calendarEvent,
    });

    console.log('Event created:', response);
};

// get list of events
export const listEvents = async () => {
    const auth = await getOAuth2Client();

    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    });

    const events = response.data.items;
    if (events.length) {
        console.log('Upcoming 10 events:');
        events.map((event, i) => {
            const start = event.start.dateTime || event.start.date;
            console.log(`${start} - ${event.summary}`);
        });
    } else {
        console.log('No upcoming events found.');
    }
};

// delete event
export const deleteEvent = async (eventId) => {
    const auth = await getOAuth2Client();

    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({
        calendarId: 'primary',
        eventId,
    });

    console.log('Event deleted');
};


