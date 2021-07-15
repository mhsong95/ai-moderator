from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Text
from urllib.parse import parse_qs
from IPython.display import display

################# BERT & BART ###########################################
# INITIALIZE [BERT&BART] 
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

################# BERT & BART ###########################################


################# Ko-BERT & Ko-BART ###########################################
# INITIALIZE [Ko-BERT & Ko-BART] 
import sys
pwd = sys.path[0]
kobert_path = pwd.split("ai-moderator")[0]+"ai-moderator/summarizer/KoBertSum"
kobart_path = pwd.split("ai-moderator")[0]+"ai-moderator/summarizer/KoBART-summarization"
sys.path.append(kobert_path); sys.path.append(kobart_path); 

# Ko-BERT
from src.test_summarize_string import KOBERT_SUMMARIZER
kobert_model = KOBERT_SUMMARIZER()

# Ko-BART
import torch
from kobart import get_kobart_tokenizer
from transformers.modeling_bart import BartForConditionalGeneration 
#from transformers.models.bart import BartForConditionalGeneration
kobart_model = BartForConditionalGeneration.from_pretrained(kobart_path+'/kobart_summary')#, from_tf=True)
kobart_tokenizer = get_kobart_tokenizer()

def kobert_summarizing_model(input_txt):
    sent = 3
    encode = kobert_model.encode(input_txt)
    summaries = kobert_model.generate(encode, sent)
    summary = " ".join(summaries)

    return summary

def kobart_summarizing_model(input_txt):
    text = input_txt.replace('\n', '')
    input_ids = kobart_tokenizer.encode(text)
    input_ids = torch.tensor(input_ids)
    input_ids = input_ids.unsqueeze(0)
    summary = kobart_model.generate(input_ids, eos_token_id=1, max_length=64, num_beams=5, early_stopping=True)
    summary = kobart_tokenizer.decode(summary[0], skip_special_tokens=True)
    
    return summary
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

### Keyword extraction ###
# TODO: Install krwordrank, khaiii
from krwordrank.word import summarize_with_keywords
import os
from khaiii import KhaiiiApi

khaiiiWord = KhaiiiApi()

class TextClass:
    def __init__(self, text):
        self.keywords = []
        self.text = text
    def add_keyword(self, key):
        self.keywords.append(key)

def preprocessing(text):
    sentences = text.replace("\n", "").replace('?', '.').replace('!', '.').split('. ')
    processed_text = ''
    for sentence in sentences:
        word_analysis = khaiiiWord.analyze(sentence)
        temp = []
        for word in word_analysis:
            for morph in word.morphs:
                if morph.tag in ['NNP', 'NNG'] and len(morph.lex) > 1:
                    temp.append(morph.lex)
        temp = ' '.join(temp)
        temp += '. '
        processed_text += temp
    return processed_text


def extract_top5_keywords(text):
    top5_keywords = []
    processed_text = preprocessing(text)
    sentences = processed_text.split('. ')
    try:
        keywords = summarize_with_keywords(sentences, min_count=1, max_length=15)
        for word, r in sorted(keywords.items(), key=lambda x:x[1], reverse=True)[:5]:
            top5_keywords.append(word)
        return top5_keywords
    except ValueError:
        print("ValueError: No keywords were extracted.")

# Extracts keywords by comparing original text and summaries
def combined_keyword_extractor(text, po_abs, po_ext, ko_abs, ko_ext):
    res_keywords = []
    keyword_list = {}
    klist = {}
    klist['original_key'] = extract_top5_keywords(text)
    klist['po_abs_key'] = extract_top5_keywords(po_abs)
    klist['po_ext_key'] = extract_top5_keywords(po_ext)
    klist['ko_abs_key'] = extract_top5_keywords(ko_abs)
    klist['ko_ext_key'] = extract_top5_keywords(ko_ext)

    #### weights ###
    # abs (PORORO, KoBART): 2.5 / 2.3 / 2.1 / 1.9 / 1.7
    # ext (PORORO, KoBERT): 2   / 1.8 / 1.6 / 1.4 / 1.2
    # original            : 1   / 0.8 / 0.6 / 0.4 / 0.2
    for key in klist:
        if key in ['po_abs_key', 'ko_abs_key']:
            w = 2.5
        elif key in ['po_ext_key', 'ko_ext_key']:
            w = 2
        else:
            w = 1
        for keyword in klist[key]:
            if keyword in keyword_list:
                keyword_list[keyword] += w
            else:
                keyword_list[keyword] = w
            w -= 0.2
    
    # Extract Top 5 keywords with large weights
    for keyword, w in sorted(keyword_list.items(), key=lambda x: x[1], reverse=True)[:5]:
        res_keywords.append(keyword)
    return res_keywords

# def get_trending_keyword(latestText):
#     sentences = []
#     for text in latestText:
#         sentences += text.split('.')
#     sentences = list(filter(None, sentences))

#     trending_keywords = []
#     keywords = summarize_with_keywords(sentences, min_count=1, max_length=15)
#     i = 1
#     for word, r in sorted(keywords.items(), key=lambda x:x[1], reverse=True)[:10]:
#         trending_keywords.append(word)
#         i += 1
#     return trending_keywords
    
### Keyword extraction ###

class echoHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print(self.client_address)
        content_len = int(self.headers.get('Content-Length'))
        post_body = self.rfile.read(content_len).decode('utf-8')
        fields = parse_qs(post_body)
        text = fields['content'][0]

        # Get summaries
        pororo_ab_res = pororo_abstractive_model(text)
        pororo_ex_res = pororo_extractive_model(text)
        kobart_ab_res = kobart_summarizing_model(text)
        kobert_ex_res = kobert_summarizing_model(text)

        # Extract combined keywords
        keywordList = combined_keyword_extractor(text, pororo_ab_res, pororo_ex_res, 
                                                    kobart_ab_res, kobert_ex_res)

        print('Pororo Abstractive:::')
        print(pororo_ab_res)
        print('Pororo Extractive:::')
        print(pororo_ex_res)
        print('Kobert:::')
        print(kobart_ab_res)
        print('Kobart:::')
        print(kobert_ex_res)

        print('Keywords:::')
        for keyword in keywordList:
            print("#%s " % keyword, end="")
        print()

        res = pororo_ab_res+'@@@@@AB@@@@@EX@@@@@'+pororo_ex_res
        for keyword in keywordList:
            res += '@@@@@AB@@@@@EX@@@@@' + keyword

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

