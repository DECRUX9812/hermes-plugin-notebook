#!/bin/bash
# Assemble the Hermes Notebook explainer (~144s) from real plugin outputs.
set -e
cd "$(dirname "$0")"
mkdir -p seg v
V=/home/decrux/.hermes/hermes-agent/venv/bin
NB=/home/decrux/.hermes/plugin-data/hermes-notebook/notebooks/smoke-test-notebook/artifacts
VID=$NB/20261105-174607-video_overview.mp4
POD=$NB/20261105-165843-audio_overview.mp3
SHOT=/home/decrux/Code/hermes-plugin-notebook/assets/shot-05-sources.png
WAVE=$PWD/../nb-assets/waveform.png
[ -f "$WAVE" ] || WAVE=$HOME/.cache/devin/scratch/nb-assets/waveform.png

enc(){ ffmpeg -y -v error -ss "${3:-0}" -i "$1" -t "$2" -an -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" -c:v libx264 -preset fast -crf 19 "$4"; }

# v01 title card 10s
ffmpeg -y -v error -loop 1 -t 10 -i cards/title.png -vf "fps=30,format=yuv420p" -c:v libx264 -preset fast -crf 19 v/01.mp4
# v02 ken burns shot-05 16s
ffmpeg -y -v error -loop 1 -i "$SHOT" -vf "scale=2400:1260,zoompan=z='min(1.0+0.0012*on,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p" -t 16 -c:v libx264 -preset fast -crf 19 v/02.mp4
# v03 ingest montage 18s (main.mp4 6-24)
enc seg/main.mp4 18 6 v/03.mp4
# v04 ask montage 20s (main.mp4 24-44)
enc seg/main.mp4 20 24 v/04.mp4
# v05 extended sceneB 22s (extended.mp4 ~54-76)
enc seg/extended.mp4 22 54 v/05.mp4
# v06a real video_overview clip 13s muted
enc "$VID" 13 5 v/06a.mp4
# v06b podcast waveform card 13s
ffmpeg -y -v error -f lavfi -t 13 -i "color=c=0x0b0c10:s=1920x1080" -i "$WAVE" -filter_complex "[0]null[bg];[1]scale=1500:450[w];[bg][w]overlay=(W-w)/2:700:format=auto,format=yuv420p" -c:v libx264 -preset fast -crf 19 v/06b.mp4
# v07 extended sceneA 22s (extended.mp4 ~10-32: search+discover)
enc seg/extended.mp4 22 10 v/07.mp4
# v08 closing card 10s
ffmpeg -y -v error -loop 1 -t 10 -i cards/closing.png -vf "fps=30,format=yuv420p" -c:v libx264 -preset fast -crf 19 v/08.mp4

# concat video-only
printf "file '%s'\n" v/0*.mp4 v/06a.mp4 v/06b.mp4 v/07.mp4 v/08.mp4 > v/list.txt
# fix ordering: 01,02,03,04,05,06a,06b,07,08
printf "file '%s'\n" v/01.mp4 v/02.mp4 v/03.mp4 v/04.mp4 v/05.mp4 v/06a.mp4 v/06b.mp4 v/07.mp4 v/08.mp4 > v/list.txt
ffmpeg -y -v error -f concat -safe 0 -i v/list.txt -c copy v/video_only.mp4

# ---- audio: music bed 150s + VO at scene offsets + podcast snippet ----
ffmpeg -y -v error -f lavfi -i "sine=frequency=110:duration=145" -f lavfi -i "sine=frequency=164.81:duration=145" -f lavfi -i "sine=frequency=220:duration=145" -filter_complex "[0][1][2]amix=inputs=3:duration=first,volume=0.10,afade=t=in:st=0:d=2,afade=t=out:st=139:d=6[m]" -map "[m]" v/music.wav
# VO delays (ms): scenes start at 0,10,26,44,64,86,112,134 → cumulative
ffmpeg -y -v error \
 -i vo/01-title.wav -i vo/02-sources.wav -i vo/03-ask.wav -i vo/04-artifacts.wav \
 -i vo/05-media.wav -i vo/06-extras.wav -i vo/07-close.wav -i "$POD" -i v/music.wav \
 -filter_complex "\
[0]adelay=0[d0];[1]adelay=10000[d1];[2]adelay=44000[d3];[3]adelay=64000[d4];\
[4]adelay=86000[d5];[5]adelay=112000[d6];[6]adelay=134000[d7];\
[7]atrim=20:33,asetpts=PTS-STARTPTS,adelay=100000[d8];\
[d0][d1][d3][d4][d5][d6][d7][d8][9]amix=inputs=10:duration=longest:dropout_transition=0,volume=1.4,alimiter=limit=0.95[a]" \
 -map "[a]" -t 145 v/audio.wav

ffmpeg -y -v error -i v/video_only.mp4 -i v/audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest renders/explainer.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 renders/explainer.mp4
