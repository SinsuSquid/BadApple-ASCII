import os
import sys
import time
import numpy as np
import cv2
import yt_dlp

# Brightness to ASCII character palette
ASCII_CHARS = np.array(list(" .:-=+*#%@"))

def get_stream_url(youtube_url="https://www.youtube.com/watch?v=FtutLA63Cp8"):
    ydl_opts = {
        'format': 'bestvideo[height<=360][vcodec^=avc1]/best[height<=360][vcodec^=avc1]',
        'quiet': True,
        'nocheckcertificate': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=False)
        return info['url']

def render_bad_apple(youtube_url="https://www.youtube.com/watch?v=FtutLA63Cp8", width=60, loop=True):
    # Pre-calculate mapping table: map 0-255 uint8 values to ASCII palette indices
    bins = np.linspace(0, 256, len(ASCII_CHARS) + 1)
    lookup_table = np.digitize(np.arange(256), bins) - 1
    lookup_table = np.clip(lookup_table, 0, len(ASCII_CHARS) - 1)

    # Initial setup: Hide cursor
    sys.stdout.write("\033[?25l")
    sys.stdout.flush()

    try:
        while True:
            # Re-fetch fresh stream URL for each replay to prevent expired token drops
            stream_url = get_stream_url(youtube_url)
            cap = cv2.VideoCapture(stream_url)
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            if not fps or fps <= 0:
                fps = 30
            frame_delay = 1.0 / fps

            # Flag to trigger a full clean on frame 1 of this iteration
            is_first_frame_of_iteration = True

            while cap.isOpened():
                start_time = time.perf_counter()
                ret, frame = cap.read()
                if not ret:
                    break  # End of video reached, break to trigger next loop

                # Compensate for rectangular terminal font aspect ratio (~0.45x)
                height = int(frame.shape[0] * (width / frame.shape[1]) * 0.45)
                resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
                gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

                # Vectorized character mapping
                indices = lookup_table[gray]
                char_array = ASCII_CHARS[indices]
                ascii_frame = "\n".join("".join(row) for row in char_array)

                if is_first_frame_of_iteration:
                    # Complete screen clear + scrollback wipe + home cursor
                    sys.stdout.write(f"\033[2J\033[3J\033[H{ascii_frame}")
                    is_first_frame_of_iteration = False
                else:
                    # In-place overwrite for seamless rendering
                    sys.stdout.write(f"\033[H{ascii_frame}")
                    
                sys.stdout.flush()

                # High-precision frame timing
                elapsed = time.perf_counter() - start_time
                sleep_time = frame_delay - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

            cap.release()

            if not loop:
                break

    except KeyboardInterrupt:
        pass
    finally:
        # Restore terminal cursor & clean newline
        sys.stdout.write("\033[?25h\n")
        sys.stdout.flush()

if __name__ == "__main__":
    render_bad_apple(width=36, loop=True)
