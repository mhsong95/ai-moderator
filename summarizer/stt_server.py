from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Text
from urllib.parse import parse_qs
from IPython.display import display

import subprocess
import json
import requests

import os
import configparser

# import argparse

# parser = argparse.ArgumentParser()
# parser.add_argument("port", help="Input port to use in summarizer server.", type=int)
# args = parser.parse_args()
# print(args.port)
# print(type(args.port))

import sys
for line in sys.stdin:
    PORT = int(line)
print("PORT: ", PORT)

config = configparser.ConfigParser()
config.read(os.getcwd().split("ai-moderator")[0]+"ai-moderator"+ os.sep + "summarizer" +os.sep+ 'config.ini', encoding='utf-8')

# Clova Speech invoke URL
invoke_url = config['Clova_STT']['invoke_url'].split('**')
# Clova Speech secret key
secret = config['Clova_STT']['secret'].split('**')

naverKeyLen = len(invoke_url)
naverKeyCnt = 0

# Convert audio file from MediaRecorder in `moderator` into .wav format for STT process
# run following command
# - ffmpeg -i ./input_file.webm -c:a pcm_f32le ./ouput_file.wav
# parameter
# - input: filename to convert (e.g., 'input.webm')
# - output: filename to save (e.g., 'output.wav')
def convert_and_split(input, output):
    command = ['ffmpeg', '-i', input, '-c:a', 'pcm_f32le', output]
    subprocess.run(command,stdout=subprocess.PIPE,stdin=subprocess.PIPE)

class ClovaSpeechClient:
    def __init__(self, invoke_url, secret):
        self.invoke_url = invoke_url
        self.secret = secret
        
    def req_upload(self, file, completion, callback=None, userdata=None, forbiddens=None, boostings=None, sttEnable=True,
                wordAlignment=True, fullText=True, script='', diarization=None, keywordExtraction=None, groupByAudio=False):
        request_body = {
            'language': 'ko-KR',
            'completion': completion,
            'callback': callback,
            'userdata': userdata,
            'sttEnable': sttEnable,
            'wordAlignment': wordAlignment,
            'fullText': fullText,
            'script': script,
            'forbiddens': forbiddens,
            'boostings': boostings,
            'diarization': diarization,
            'keywordExtraction': keywordExtraction,
            'groupByAudio': groupByAudio,
        }
        headers = {
            'Accept': 'application/json;UTF-8',
            'X-CLOVASPEECH-API-KEY': self.secret
        }
        print(self.invoke_url)
        print(json.dumps(request_body).encode('UTF-8'))
        files = {
            'media': open(file, 'rb'),
            'params': (None, json.dumps(request_body).encode('UTF-8'), 'application/json')
        }
        response = requests.post(headers=headers, url=self.invoke_url + '/recognizer/upload', files=files)
        return response


class echoHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print(self.client_address)
        content_len = int(self.headers.get('Content-Length'))
        post_body = self.rfile.read(content_len).decode('utf-8')
        fields = json.loads(post_body)

        print("REQUEST::::::STT")
        roomID = fields["roomID"]
        user = fields["user"]
        startTimestamp = fields["startTimestamp"]
        endTimestamp = fields["endTimestamp"]
        keyIdx = fields["keyIdx"]

        # Convert file type from webm to wav
        inputfile = "../moderator/webm/"+roomID+"_"+user+"_"+str(startTimestamp)+".webm"
        outputfile = "./wav/"+roomID+"_"+user+"_"+str(startTimestamp)+".wav"
        convert_and_split(inputfile, outputfile)
        # TODO: remove[debug]
        print(inputfile +'\n'+ outputfile +'\n'+ "convert file type")
        
        # Run Naver STT for given audio file
        stt_res = ClovaSpeechClient(invoke_url[keyIdx], secret[keyIdx]).req_upload(file=outputfile, completion='sync')
        # DESIGN: trim transcript at local timestamp (endTimestamp - startTimestap)
        print("trim range: ", endTimestamp - startTimestamp)
        print(stt_res.text)
        print(json.loads(stt_res.text)['text'])
        res = json.loads(stt_res.text)['text']

        self.send_response(200)
        self.send_header('content-type', 'text/html')
        self.end_headers()
        self.wfile.write(res.encode())
        


def main():
    # PORT = int(input("!!! Input PORT to run summaerizer server :"))
    server = HTTPServer(('', PORT), echoHandler)
    print('Server running on port %s' % PORT)
    server.serve_forever()

if __name__ == '__main__':
    main()

