from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
from IPython.display import display

################# BERT & BART ###########################################
# INITIALIZE [BERT&BART] 
'''
from summarizer import Summarizer
bert_model = Summarizer()

from transformers import pipeline
bart_summarizer = pipeline("summarization")


# BERT
def bert_summarizing_model(input_txt, sent, ratio):
    if sent != 0:
        sum = bert_model(input_txt, num_sentences = sent)
    elif ratio != 0:
        sum = bert_model(input_txt, ratio = ratio)

    full = ''.join(sum)
    return full
'''
################# BERT & BART ###########################################


################# Ko-BERT & Ko-BART ###########################################
# INITIALIZE [Ko-BERT & Ko-BART] 
# import sys
# pwd = sys.path[0]
# kobert_path = pwd.split("ai-moderator")[0]+"ai-moderator/summarizer/KoBertSum"
# kobart_path = pwd.split("ai-moderator")[0]+"ai-moderator/summarizer/KoBART-summarization"
# sys.path.append(kobert_path); sys.path.append(kobart_path); 

# # Ko-BERT
# from src.test_summarize_string import KOBERT_SUMMARIZER
# kobert_model = KOBERT_SUMMARIZER()

# # Ko-BART
# import torch
# from kobart import get_kobart_tokenizer
# from transformers.modeling_bart import BartForConditionalGeneration 
# #from transformers.models.bart import BartForConditionalGeneration
# kobart_model = BartForConditionalGeneration.from_pretrained(kobart_path+'/kobart_summary')#, from_tf=True)
# kobart_tokenizer = get_kobart_tokenizer()


# def kobert_summarizing_model(input_txt, sent, ratio):
#     encode = kobert_model.encode(input_txt)
#     summaries = kobert_model.generate(encode, sent)
#     summary = " ".join(summaries)

#     return summary

# def kobart_summarizing_model(input_txt):
#     text = input_txt.replace('\n', '')

#     input_ids = kobart_tokenizer.encode(text)
#     input_ids = torch.tensor(input_ids)
#     input_ids = input_ids.unsqueeze(0)
#     summary = kobart_model.generate(input_ids, eos_token_id=1, max_length=64, num_beams=5, early_stopping=True)
#     summary = kobart_tokenizer.decode(summary[0], skip_special_tokens=True)
    
#     return summary
################# Ko-BERT & Ko-BART ###########################################

################# Pororo ###########################################
from pororo import Pororo
summ_abstractive = Pororo(task="summarization", model="abstractive", lang="ko")
summ_extractive = Pororo(task="summarization", model="extractive", lang="ko")
def pororo_abstractive_model(input_txt):
    summary = summ_abstractive(input_txt)
    if len(summary) > len(input_txt):
        print("INVALID:::")
        print(input_txt)
    return summary

def pororo_extractive_model(input_txt):
    summary = summ_extractive(input_txt)
    return summary
################# Pororo ###########################################



class echoHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print(self.client_address)
        content_len = int(self.headers.get('Content-Length'))
        post_body = self.rfile.read(content_len).decode('utf-8')
        fields = parse_qs(post_body)

        pororo_ab_res = pororo_abstractive_model(fields['content'][0])
        pororo_ex_res = pororo_extractive_model(fields['content'][0])
        
        print('Pororo Abstractive:::')
        print(pororo_ab_res)
        print('Pororo Extractive:::')
        print(pororo_ex_res)

        res = pororo_ab_res+'@@@@@AB@@@@@EX@@@@@'+pororo_ex_res

        self.send_response(200)
        self.send_header('content-type', 'text/html')
        self.end_headers()
        self.wfile.write(res.encode())

def main():
    PORT = 4040
    server = HTTPServer(('', PORT), echoHandler)
    print('Server running on port %s' % PORT)
    server.serve_forever()


if __name__ == '__main__':
    main()

