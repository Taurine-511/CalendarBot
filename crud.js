const fs = require('fs').promises;
const { google } = require('googleapis');

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

// Event Example
// const event = {
//     'summary': 'サンプル',
//     'description': 'カレンダー説明',
//     'start': {
//         'dateTime': moment().add(1, 'h').format(),
//         'timeZone': 'Asia/Tokyo',
//     },
//     'end': {
//         'dateTime': moment().add(2, 'h').format(),
//         'timeZone': 'Asia/Tokyo',
//     },
//     'colorId': 2, // @see https://lukeboyle.com/blog-posts/2016/04/google-calendar-api---color-id
//     'reminders': {
//         'useDefault': false,
//         'overrides': [
//             { 'method': 'email', 'minutes': 120 },
//             { 'method': 'popup', 'minutes': 30 },
//         ],
//     },
// };


// add event
const addEvent = async (calendarEvent) => {
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
const listEvents = async () => {
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
    return events;
};

// delete event
const deleteEvent = async (eventId) => {
    const auth = await getOAuth2Client();

    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({
        calendarId: 'primary',
        eventId,
    });

    console.log('Event deleted');
};

module.exports = {
    addEvent,
    listEvents,
    deleteEvent,
  };
