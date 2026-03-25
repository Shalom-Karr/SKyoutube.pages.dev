# SK Video Dashboard - YouTube API Compliance Documentation

This document provides a comprehensive overview of the SK Video Dashboard application, its features, technical implementation, and its use of the YouTube API Services. It is intended to assist the YouTube API Services team with their compliance audit.

**Author:** [Shalom Karr]
**Contact:** [shalomkarrsphone@gmail.com]
**Date:** [October 22,2025]

---

### Table of Contents
1.  [Project Overview](#1-project-overview)
2.  [Core Features](#2-core-features)
3.  [Live Application Access](#3-live-application-access)
4.  [Technical Implementation & API Usage](#4-technical-implementation--api-usage)
    - [Application Architecture](#application-architecture)
    - [API Key Security](#api-key-security)
    - [Specific API Endpoints Used](#specific-api-endpoints-used)
5.  [Compliance with YouTube Policies](#5-compliance-with-youtube-policies)
    - [Terms of Service & Privacy Policy](#terms-of-service--privacy-policy)
    - [Data Storage and Caching (30-Day Policy)](#data-storage-and-caching-30-day-policy)
    - [Branding and Attribution](#branding-and-attribution)
    - [Monetization](#monetization)
6.  [Conclusion](#6-conclusion)

---

### 1. Project Overview

The SK Video Dashboard is a web-based application built for passionate YouTube viewers who want a more organized and curated way to manage their favorite content. The project began as a personal tool to solve my own need for a focused viewing experience, free from algorithmic distractions.

The application's core purpose is to **complement, not replace, the main YouTube platform**. It provides "power user" tools that allow individuals to:
- Aggregate content from their favorite creators into a single view.
- Maintain a persistent, personal library of saved videos.
- Discover new content from specific channels more easily.

Our goal is to enhance the viewer experience and provide a valuable, free tool for the YouTube community.

### 2. Core Features

The application provides the following key functionalities:

*   **Follow Creators:** Users can search for and "follow" YouTube channels. The dashboard then maintains this list in the user's local browser storage.
*   **Curated Video Feed:** Users can trigger a refresh that fetches the latest videos from all their followed channels, presenting them in a clean, chronological dropdown list.
*   **Save Videos:** Users can save any YouTube video (via direct link or search) to a persistent "Saved Videos" grid for easy access.
*   **Search & Discovery:** Users can search the YouTube platform for both new videos and new creators to follow directly within the application.
*   **Video Playback:** All video playback is handled exclusively through the standard, unaltered YouTube `<iframe>` Embedded Player.

### 3. Live Application Access

The SK Video Dashboard is publicly accessible and requires no login. The application can be reviewed at the following URLs:

- **Primary:** `https://skvideo.pages.dev/`
- **Alternate:** `https://sktube.pages.dev/`

### 4. Technical Implementation & API Usage

#### Application Architecture

The application is a modern static web application (HTML, CSS, JavaScript) that interacts with a **server-side proxy** for all YouTube API calls.

- **Frontend:** A pure client-side application that runs in the user's browser. It manages state using Local Storage.
- **Backend:** A serverless function (hosted on Cloudflare Pages/Netlify) acts as a secure proxy. The frontend sends requests to this proxy, which then securely communicates with the YouTube API.

#### API Key Security

Protecting the API credential is a top priority.

1.  **No Client-Side Exposure:** The YouTube API key is **never** exposed in the frontend JavaScript code or in any publicly accessible file.
2.  **Server-Side Storage:** The API key is stored exclusively as an environment variable on the hosting platform (Cloudflare/Netlify) and is only accessible by the serverless proxy function.
3.  **Application Restrictions:** The API key is further secured in the Google Cloud Console with the following restrictions:
    - **API Restriction:** The key is locked down to only allow access to the **YouTube Data API v3**.
    - **IP Address Restriction:** For server-based proxies like Cloudflare, the key is restricted to only accept requests originating from official Cloudflare IP ranges.

#### Specific API Endpoints Used

The application uses the **YouTube Data API v3** in the following ways:

-   **`search.list`**
    -   `part=snippet`, `type=channel`: Used when a user searches for a creator in the "Search Creators" tab.
    -   `part=snippet`, `type=video`: Used when a user searches for a video in the "Search Videos" tab.
    -   `part=snippet`, `channelId={id}`, `order=date`: Used by the "Check for new videos" feature to get a list of the latest video IDs from a followed channel.

-   **`videos.list`**
    -   `part=snippet`: Used to fetch the video title when a user saves a video via a direct link.
    -   `part=snippet,statistics,contentDetails`: Used to fetch full metadata (title, views, duration, etc.) for the list of video IDs returned by the `search.list` call for followed channels.

### 5. Compliance with YouTube Policies

We have made every effort to ensure full compliance with all relevant YouTube policies.

#### Terms of Service & Privacy Policy

-   The application provides a **Privacy Policy** and **Terms of Service**, which are prominently linked in the site footer.
-   Our Privacy Policy explicitly discloses our use of the YouTube API Services and contains a direct link to the **Google Privacy Policy**, as required.

#### Data Storage and Caching (30-Day Policy)

-   In compliance with the Developer Policies, any API data cached in the user's browser (such as recent video lists for followed channels) is stored with a timestamp.
-   This cached data is **automatically invalidated and refreshed via a new API call if it is older than 30 days**.

#### Branding and Attribution

-   The application is named "SK Video Dashboard," which does not use the "YouTube" trademark in a confusing way.
-   Attribution to YouTube is provided in two main ways:
    1.  A "YouTube" platform badge is displayed on every saved video card.
    2.  All video playback uses the standard, unaltered **YouTube Embedded Player**, which contains the official YouTube logo and branding.

#### Monetization

-   The application **does not interfere with YouTube's monetization** in any way. By using the standard `<iframe>` Embedded Player, all advertisements are served normally as determined by YouTube and the content creator.

### 6. Conclusion

The SK Video Dashboard is designed to be a compliant, secure, and valuable tool that enhances the YouTube experience for dedicated viewers. We are committed to operating within the YouTube API Services Terms of Service and welcome a full audit of our application. We are prepared to make any necessary adjustments to ensure continued compliance.

Thank you for your time and consideration.
