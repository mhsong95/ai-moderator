from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
from IPython.display import display

######## INITIALIZE [BERT&BART] ####
from summarizer import Summarizer
bert_model = Summarizer()

from transformers import pipeline
bart_summarizer = pipeline("summarization")
######## INITIALIZE [BERT&BART] ####

######## INITIALIZE [KO-BERT] ####
import sys
pwd = sys.path[0]; kobert_path = pwd.split("ai-moderator")[0]+"ai-moderator/summarizer/KoBertSum"
sys.path.append(kobert_path)
from src.test_summarize_string import KOBERT_SUMMARIZER

kobert_model = KOBERT_SUMMARIZER()
######## INITIALIZE [KO-BERT] ####


def bert_summarizing_model(input_txt, sent, ratio):
    if sent != 0:
        sum = bert_model(input_txt, num_sentences = sent)
    elif ratio != 0:
        sum = bert_model(input_txt, ratio = ratio)

    full = ''.join(sum)
    return full

def kobert_summarizing_model(input_txt, sent, ratio):
    encode = kobert_model.encode(text)
    summaries = kobert_model.generate(encode, sent)
    summary = " ".join(summaries)

    return summary

class echoHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print(self.client_address)
        content_len = int(self.headers.get('Content-Length'))
        post_body = self.rfile.read(content_len).decode('utf-8')
        fields = parse_qs(post_body)
        res = bert_summarizing_model(fields['content'][0], 1, 0)
        print(res)

        self.send_response(200)
        self.send_header('content-type', 'text/html')
        self.end_headers()
        self.wfile.write(res.encode())

def main():
    PORT = 5050
    server = HTTPServer(('', PORT), echoHandler)
    print('Server running on port %s' % PORT)
    server.serve_forever()

if __name__ == '__main__':
    main()

