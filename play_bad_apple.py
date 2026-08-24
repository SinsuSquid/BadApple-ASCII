import cv2
import sys
import time
import yt_dlp

ASCII_CHARS = " .:-=+*#%@"

def get_stream_url(youtube_url="https://www.youtube.com/watch?v=FtutLA63Cp8"):
    ydl_opts = {'format': 'bestvideo[height=360]', 'quiet': True, 'nocheckcertificate': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=False)
        return info['url']

def render_bad_apple(stream_url, width=40):
    cap = cv2.VideoCapture(stream_url)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_delay = 1.0 / fps
    scale_factor = len(ASCII_CHARS) / 256

    # Clear screen and hide cursor
    sys.stdout.write("\033[2J\033[?25l")
    sys.stdout.flush()

    try:
        while cap.isOpened():
            start_time = time.time()
            ret, frame = cap.read()
            if not ret:
                break

            # Scale aspect ratio for terminal font spacing
            height = int(frame.shape[0] * (width / frame.shape[1]) * 0.45)
            resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

            # Build ASCII buffer
            frame_buffer = []
            for row in gray:
                frame_buffer.append("".join(ASCII_CHARS[int(pixel * scale_factor)] for pixel in row))
            
            # Print frame to terminal without flicker
            sys.stdout.write("\033[H" + "\n".join(frame_buffer))
            sys.stdout.flush()

            # Dynamic FPS sync
            elapsed = time.time() - start_time
            sleep_time = frame_delay - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        # Restore cursor
        sys.stdout.write("\033[?25h\n")
        sys.stdout.flush()

if __name__ == "__main__":
    url = get_stream_url()
    render_bad_apple(url, width=36)
