import subprocess

def convert_and_split(filename):
    command = ['ffmpeg', '-i', filename, '-c:a', 'pcm_f32le', 'out%09d.wav']
    subprocess.run(command,stdout=subprocess.PIPE,stdin=subprocess.PIPE)

filename = "6f3aa3b4-31db-427c-880e-d930d8a6c5f9_seoyun_1627311980035.wav"

convert_and_split(filename)