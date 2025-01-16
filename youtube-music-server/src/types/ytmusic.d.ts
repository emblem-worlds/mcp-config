declare module 'ytmusic' {
  interface Song {
    videoId: string;
    title: string;
    artist: string;
    duration: string;
  }

  interface Playlist {
    id: string;
    title: string;
  }

  export default class YTMusic {
    constructor();
    searchSongs(query: string): Promise<Song[]>;
    createPlaylist(title: string, description?: string): Promise<Playlist>;
    addToPlaylist(playlistId: string, videoId: string): Promise<void>;
  }
}
