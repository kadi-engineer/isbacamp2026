# Fragrance of Zion – Travel Companion

A mobile-first event companion app for the Fragrance of Zion church travel trip. Protected by a passcode, it provides a centralized hub for trip logistics and community sharing.

## Features

- **Passcode Gate** – 4-digit PIN entry (1925) protects all content
- **Announcements** – Live feed backed by Netlify Database; trip coordinators can post and pin updates in real time
- **Schedule** – Day-by-day itinerary with a timeline view
- **Room Arrangements** – Searchable lodge/room assignments
- **Departure List** – Bus assignments with passenger search
- **Fragrance of Zion Submission** – Form for members to submit testimonies, poems, songs, and reflections
- **Need Help? Banner** – Floating button with coordinator contact info

## Tech Stack

- [TanStack Start](https://tanstack.com/start) – Full-stack React meta-framework
- [Tailwind CSS v4](https://tailwindcss.com/) – Utility-first styling
- [Netlify Database](https://docs.netlify.com/database/) – Managed Postgres for announcements (via Drizzle ORM)
- [Netlify](https://netlify.com) – Hosting and serverless infrastructure

## Run Locally

```bash
npm install
netlify dev
```

The app will be available at `http://localhost:8888`. The Netlify CLI handles database connectivity and function emulation automatically.
