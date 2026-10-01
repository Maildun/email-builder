const YOUTUBE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/;

/** The id of a YouTube video link, or undefined for anything else. */
export function youtubeId(url: string | undefined): string | undefined {
  return url ? YOUTUBE.exec(url.trim())?.[1] : undefined;
}

/**
 * The poster for a video block: its own thumbnail, else the YouTube one.
 * `maxresdefault` is a true 16:9 frame (the smaller sizes are 4:3 with black
 * bars that show when the frame narrows); videos uploaded below HD don't have
 * one, so those need a thumbnail of their own.
 */
export function videoThumbnail(props: { url?: string; thumbnail?: string }): string | undefined {
  if (props.thumbnail) return props.thumbnail;
  const id = youtubeId(props.url);
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : undefined;
}
