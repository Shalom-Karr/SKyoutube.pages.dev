
import os
import sys
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- CONFIGURATION ---
# The name of the file containing artist names, one per line.
ARTIST_FILE = 'artist_names.txt'
# The name of the output SQL file.
SQL_OUTPUT_FILE = 'artists.sql'
# The name of the table in your Supabase database.
TABLE_NAME = 'artists'
# Set to True to get more detailed logging in the console.
VERBOSE = True

def log(message):
    """Prints a message to the console if VERBOSE is True."""
    if VERBOSE:
        print(message)

def get_channel_id(youtube, artist_name):
    """
    Searches for a YouTube channel by artist name and returns the channel ID.
    """
    try:
        search_response = youtube.search().list(
            q=artist_name,
            part='snippet',
            maxResults=1,
            type='channel'
        ).execute()

        if not search_response.get('items'):
            log(f"-> No channel found for '{artist_name}'. Skipping.")
            return None

        channel = search_response['items'][0]
        channel_id = channel['snippet']['channelId']
        channel_title = channel['snippet']['title']
        log(f"-> Found channel for '{artist_name}': '{channel_title}' (ID: {channel_id})")
        return channel_id
    except HttpError as e:
        print(f"An HTTP error {e.code} occurred for artist '{artist_name}':\n{e.content}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred for artist '{artist_name}': {e}")
        return None


def generate_sql_file(api_key):
    """
    Generates an SQL file with INSERT statements for each artist.
    """
    if not os.path.exists(ARTIST_FILE):
        print(f"Error: Artist file not found at '{ARTIST_FILE}'")
        sys.exit(1)

    with open(ARTIST_FILE, 'r', encoding='utf-8') as f:
        artist_names = [line.strip() for line in f if line.strip()]

    log(f"Found {len(artist_names)} artists in '{ARTIST_FILE}'.")

    try:
        youtube = build('youtube', 'v3', developerKey=api_key)
        log("Successfully connected to YouTube Data API.")
    except Exception as e:
        print(f"Error building YouTube API client: {e}")
        print("Please ensure your API key is valid.")
        sys.exit(1)

    sql_statements = []
    for artist_name in artist_names:
        channel_id = get_channel_id(youtube, artist_name)
        if channel_id:
            # Escape single quotes in artist names for SQL
            sanitized_name = artist_name.replace("'", "''")
            sql_statements.append(
                f"INSERT INTO {TABLE_NAME} (name, channel_id) VALUES ('{sanitized_name}', '{channel_id}');"
            )

    if not sql_statements:
        print("No channels were found. The output file will not be created.")
        return

    with open(SQL_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_statements))

    print(f"\n✅ Successfully generated '{SQL_OUTPUT_FILE}' with {len(sql_statements)} artists.")
    print("Please review the file for accuracy before running it on your database.")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        # You can also set the API key as an environment variable
        api_key_from_env = os.environ.get('YOUTUBE_API_KEY')
        if api_key_from_env:
             print("Using YouTube API key from environment variable.")
             generate_sql_file(api_key_from_env)
        else:
            print("Usage: python get_channel_ids.py <YOUR_YOUTUBE_API_KEY>")
            print("Alternatively, set the YOUTUBE_API_KEY environment variable.")
            sys.exit(1)
    else:
        api_key = sys.argv[1]
        generate_sql_file(api_key)
