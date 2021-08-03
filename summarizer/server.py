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
invoke_url = config['Clova_STT']['invoke_url']
# Clova Speech secret key
secret = config['Clova_STT']['secret']

# Convert audio file from MediaRecorder in `moderator` into .wav format for STT process
# run following command
# - ffmpeg -i ./input_file.webm -c:a pcm_f32le ./ouput_file.wav
# parameter
# - input: filename to convert (e.g., 'input.webm')
# - output: filename to save (e.g., 'output.wav')
def convert_and_split(input, output):
    command = ['ffmpeg', '-i', input, '-c:a', 'pcm_f32le', output]
    subprocess.run(command,stdout=subprocess.PIPE,stdin=subprocess.PIPE)

################# BERT & BART ###########################################
# # INITIALIZE [BERT&BART] 
# from summarizer import Summarizer
# bert_model = Summarizer()

# from transformers import pipeline
# bart_summarizer = pipeline("summarization")

# # BERT
# def bert_summarizing_model(input_txt, sent, ratio):
#     if sent != 0:
#         sum = bert_model(input_txt, num_sentences = sent)
#     elif ratio != 0:
#         sum = bert_model(input_txt, ratio = ratio)

#     full = ''.join(sum)
#     return full
################# BERT & BART ###########################################


################# Ko-BERT & Ko-BART ###########################################
# INITIALIZE [Ko-BERT & Ko-BART] 
import sys

from khaiii.khaiii import KhaiiiExcept
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
# from transformers.models.bart import BartForConditionalGeneration
kobart_model = BartForConditionalGeneration.from_pretrained(kobart_path+'/kobart_summary')#, from_tf=True)
kobart_tokenizer = get_kobart_tokenizer()

def kobert_summarizing_model(input_txt):
    try :
        sent = 3
        encode = kobert_model.encode(input_txt)
        summaries = kobert_model.generate(encode, sent)
        summary = " ".join(summaries)
    except:
        return ""

    return summary

def kobart_summarizing_model(input_txt):
    try :
        text = input_txt.replace('\n', '')
        input_ids = kobart_tokenizer.encode(text)
        input_ids = torch.tensor(input_ids)
        input_ids = input_ids.unsqueeze(0)
        summary = kobart_model.generate(input_ids, eos_token_id=1, max_length=64, num_beams=5, early_stopping=True)
        summary = kobart_tokenizer.decode(summary[0], skip_special_tokens=True)

        if len(summary) > len(input_txt):
            print("INVALID:::", input_txt)
            return ""
    except:
        return ""

    return summary
################# Ko-BERT & Ko-BART ###########################################

################# Pororo ###########################################
from pororo import Pororo
summ_abstractive = Pororo(task="summarization", model="abstractive", lang="ko")
summ_extractive = Pororo(task="summarization", model="extractive", lang="ko")

def pororo_abstractive_model(input_txt):
    try :
        summary = summ_abstractive(input_txt)
        if len(summary) > len(input_txt):
            print("INVALID:::", input_txt)
            return ""
    except:
        return ""
    return summary

def pororo_extractive_model(input_txt):
    try: 
        summary = summ_extractive(input_txt)
    except:
        return ""
    return summary
################# Pororo ###########################################

### Keyword extraction ###
from krwordrank.word import summarize_with_keywords
import os
from khaiii import KhaiiiApi

khaiiiWord = KhaiiiApi()

def preprocessing(text):
    sentences = text.replace("\n", " ").replace('?', '.').replace('!', '.').split('.')
    sentences = [x.strip() for x in sentences]
    sentences = list(filter(None, sentences))
    processed_text = ''
    try:
        for sentence in sentences:
            word_analysis = khaiiiWord.analyze(sentence)
            temp = []
            for word in word_analysis:
                for morph in word.morphs:
                    if morph.tag in ['NNP', 'NNG', 'SL', 'ZN'] and len(morph.lex) > 1:
                        temp.append(morph.lex)
            temp = ' '.join(temp)
            temp += '. '
            processed_text += temp
        return processed_text
    except KhaiiiExcept:
        print("형태소 분석에 실패했습니다.")
        return ""

def extract_top5_keywords(text):
    if text == "":
        print("RETURN EMPTY KEYWORD LIST", text)
        return []
    top5_keywords = []
    processed_text = preprocessing(text)
    sentences = processed_text.split('. ')
    try:
        keywords = summarize_with_keywords(sentences, min_count=1, max_length=15)
        for word, r in sorted(keywords.items(), key=lambda x:x[1], reverse=True)[:5]:
            top5_keywords.append(word)
        print("KEYWORDS", top5_keywords)
        return top5_keywords
    except ValueError:
        print("ValueError: No keywords were extracted.")
        return []

def combined_keyword_extractor(text, po_abs, po_ext, ko_abs, ko_ext):
    res_keywords = []
    keyword_list = {}
    klist = {}
    klist['original_key'] = extract_top5_keywords(text)
    klist['po_abs_key'] = extract_top5_keywords(po_abs)
    klist['po_ext_key'] = extract_top5_keywords(po_ext)
    klist['ko_abs_key'] = extract_top5_keywords(ko_abs)
    klist['ko_ext_key'] = extract_top5_keywords(ko_ext)

    #### Weights (Total: 10) ###
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

keyword_trends = {}
def get_trending_keyword(new_keywords):
    top10_trending = []
    for key in keyword_trends:
        keyword_trends[key] *= 0.8
    i = 5
    for keyword in new_keywords:
        if keyword in keyword_trends:
            keyword_trends[keyword] += i
        else:
            keyword_trends[keyword] = i
        i -= 1
    
    for word, score in sorted(keyword_trends.items(), key=lambda x:x[1], reverse=True)[:10]:
        # Set the lower bound for trending keywords
        if score > 3:
            top10_trending.append(word)
    return top10_trending
    
### Keyword extraction ###


################# GET Confidence Sore ###########################################
from rouge import Rouge 
from numpy import inner, mean

## ROUGE
rouge = Rouge()
def get_rouge_score(summary1, summary2):
    # return average of (Rouge-1, 2, L 's F1-score)
    score_keys = ['rouge-1', 'rouge-2', 'rouge-l']
    rouge_score = rouge.get_scores(summary1, summary2)
    F1_rouge = [[score[key]['f'] for key in score_keys] for score in rouge_score]
    return mean(F1_rouge)

## GOOGLE ENCODER
import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
from absl import logging

import tensorflow.compat.v1 as tf
tf.disable_v2_behavior()

import sentencepiece as spm
import matplotlib.pyplot as plt
import pandas as pd
import re
import seaborn as sns

hub_module = hub.Module("https://tfhub.dev/google/universal-sentence-encoder-lite/2")
input_placeholder = tf.sparse_placeholder(tf.int64, shape=[None, None])
encodings = hub_module(
    inputs=dict(
        values=input_placeholder.values,
        indices=input_placeholder.indices,
        dense_shape=input_placeholder.dense_shape))

with tf.Session() as sess:
  spm_path = sess.run(hub_module(signature="spm_path"))

sp = spm.SentencePieceProcessor()
with tf.io.gfile.GFile(spm_path, mode="rb") as f:
  sp.LoadFromSerializedProto(f.read())

def process_to_IDs_in_sparse_format(sp, sentences):
  ids = [sp.EncodeAsIds(x) for x in sentences]
  max_len = max(len(x) for x in ids)
  dense_shape=(len(ids), max_len)
  values=[item for sublist in ids for item in sublist]
  indices=[[row,col] for row in range(len(ids)) for col in range(len(ids[row]))]
  return (values, indices, dense_shape)

def get_google_universal_score(summary1, summary2):
    messages = [summary1, summary2]
    with tf.Session() as session:
        session.run(tf.global_variables_initializer())
        session.run(tf.tables_initializer())
        values, indices, dense_shape = process_to_IDs_in_sparse_format(sp,messages)

        message_embeddings = session.run(
            encodings,
            feed_dict={input_placeholder.values: values,
                        input_placeholder.indices: indices,
                        input_placeholder.dense_shape: dense_shape})
        # corr = np.inner(message_embeddings, message_embeddings)
        corr = inner(message_embeddings, message_embeddings)
    return corr[0][1]

## SCORE BY KEYWORD EXTRACTION
def get_keyword_score(summary, keywordList):
    if len(keywordList) == 0:
        return False, 0
    
    return True, len(list(filter(lambda x : x in summary, keywordList))) / len(keywordList) 


################# CONFIDENCE SCORE
def get_confidence_score_between_two(summary, compare_summary, keywordList):
    if compare_summary == "":
        return keyword_score

    rouge_score = get_rouge_score(summary, compare_summary)
    google_score = get_google_universal_score(summary, compare_summary)

    score_list = [rouge_score, google_score]
    return mean(score_list)

def get_confidence_score(summary, compare_summarylist, keywordList):
    if summary == "":
        return 0

    score_type_num_add, keyword_score = get_keyword_score(summary, keywordList)
    confidence_scores = [keyword_score] if score_type_num_add else []

    for compare_summary in compare_summarylist:
        if compare_summary == "":
            continue

        confidence_score = get_confidence_score_between_two(summary, compare_summary, keywordList)
        confidence_scores.append(confidence_score)
    
    return mean(confidence_scores)


################# GET Confidence Sore ###########################################

def select_rep_summary(abs_summary1, abs_summary2, ext_summary1, ext_summary2):
    # SELECT Representation summary for each extractive, abstractive summmary

    abs_summary, abs_compare_summary = abs_summary1, abs_summary2
    ext_summary, ext_compare_summary = ext_summary1, ext_summary2

    if abs_summary == "" and abs_compare_summary != "":
        abs_summary, abs_compare_summary  = abs_compare_summary, abs_summary
    if ext_summary == "" and ext_compare_summary != "":
        ext_summary, ext_compare_summary  = ext_compare_summary, ext_summary

    return abs_summary, abs_compare_summary, ext_summary, ext_compare_summary 

import re
def get_summaries(text):
    print("get_summaries for text: "+text)
    # DO NOT SUMMARIZE TEXT when text is short enough / JUST GET ABSTRACTIVE SUMMARY
    text_sentence_num = len(re.split('[.?!]', text)) 

    pororo_ab_res = pororo_abstractive_model(text)
    pororo_ex_res = pororo_extractive_model(text) if text_sentence_num > 3 else text
    kobart_ab_res = kobart_summarizing_model(text)
    kobert_ex_res = kobert_summarizing_model(text) if text_sentence_num > 3 else text

    return pororo_ab_res, pororo_ex_res, kobart_ab_res, kobert_ex_res

def get_overall_summaries(text, keyword):
    print("get_overall_summaries for keyword: " + keyword)

    # Only need extractive summary
    text_sentence_num = len(re.split('[.?!]', text)) 
    pororo_ab_res, kobart_ab_res = text, text

    # Generate Extractive summary
    pororo_ex_res = pororo_extractive_model(text) if text_sentence_num > 3 else text
    kobert_ex_res = kobert_summarizing_model(text) if text_sentence_num > 3 else text

    # If all summaries generated successfully
    if pororo_ex_res != "" and kobert_ex_res != "":
        return pororo_ab_res, pororo_ex_res, kobart_ab_res, kobert_ex_res

    # Generate Extractive summary with new sentences
    sentences = text.split(". ")
    sentences_with_keyword = []
    for sentence in sentences:
        if keyword in sentence:
            sentences_with_keyword.append(sentence)
    pororo_ex_res = pororo_extractive_model('. '.join(sentences_with_keyword))
    kobert_ex_res = kobert_summarizing_model('. '.join(sentences_with_keyword))

    # Pick first 5 sentences if there is an error while generating summaries
    pororo_ex_res = pororo_ex_res if pororo_ex_res != "" else '. '.join(sentences_with_keyword[-5:])
    kobert_ex_res = kobert_ex_res if kobert_ex_res != "" else '. '.join(sentences_with_keyword[-5:])

    return pororo_ab_res, pororo_ex_res, kobart_ab_res, kobert_ex_res

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
        if fields["type"] == "requestSTT":
            print("REQUEST::::::STT")
            roomID = fields["roomID"]
            user = fields["user"]
            startTimestamp = fields["startTimestamp"]
            endTimestamp = fields["endTimestamp"]
            audioFileList = fields["audioFileList"]

            # Traverse audioFileList and convert file type from webm to wav
            wavFiles = []
            for t in audioFileList:
                inputfile = "../moderator/webm/"+roomID+"_"+user+"_"+str(t)+".webm"
                outputfile = "./wav/"+roomID+"_"+user+"_"+str(t)+".wav"
                wavFiles.append(outputfile)
                convert_and_split(inputfile, outputfile)
                # TODO: remove[debug]
                print(inputfile +'\n'+ outputfile +'\n'+ "convert file type")
            
            # Traverse audioFileList and run Naver STT for each files
            # DESIGN: Combine STT result and make timestamp sync using startTimestamp and endTimestamp if needed
            returnText = ''
            for wav in wavFiles:
                stt_res = ClovaSpeechClient(invoke_url, secret).req_upload(file=wav, completion='sync')
                print(stt_res.text)
                print(json.loads(stt_res.text)['text'])
                returnText += json.loads(stt_res.text)['text']
            
            # Return result text
            res = returnText
        elif fields["type"] == "requestSummary":
            print("REQUEST::::::SUMMARY")
            user_name = fields["user"]    # Only for overall summary request
            text = fields["content"]

            # Check if request for an overall summary (fields["user"] == "OVERALL" + keyword)
            if (user_name[:7] == "OVERALL"):
                pororo_ab_res, pororo_ex_res, kobart_ab_res, kobert_ex_res = get_overall_summaries(text, user_name[7:])
            else:
                pororo_ab_res, pororo_ex_res, kobart_ab_res, kobert_ex_res = get_summaries(text)
                
            print("pororo_ab_res:   "+ pororo_ab_res)
            print("pororo_ex_res:   "+ pororo_ex_res)
            print("kobart_ab_res:   "+ kobart_ab_res)
            print("kobert_ex_res:   "+ kobert_ex_res)

            # Extract combined keywords
            keywordList = combined_keyword_extractor(text, pororo_ab_res, pororo_ex_res, kobart_ab_res, kobert_ex_res)
            # Extract Top 10 trending keywords
            top10_trending = get_trending_keyword(keywordList)

            # Calculate confidence score
            abs_summary, abs_compare_summary, ext_summary, ext_compare_summary = select_rep_summary(pororo_ab_res, kobart_ab_res, pororo_ex_res, kobert_ex_res)
            if abs_summary == "":
                abs_summary = text; ab_confidence_score = 1
            else :
                ab_confidence_score = get_confidence_score(abs_summary, [abs_compare_summary, ext_summary, ext_compare_summary], keywordList) 
                
            ext_summary = ext_summary if ext_summary!= "" else text

            # Concatenate summaries, keywords, trending keywords
            keywordString = '@@@@@CD@@@@@AX@@@@@'.join(keywordList)
            trendingString = '@@@@@CD@@@@@AX@@@@@'.join(top10_trending)
            res = '@@@@@AB@@@@@EX@@@@@'.join([abs_summary, ext_summary, keywordString, trendingString])
            res += "@@@@@CF@@@@@" + str(ab_confidence_score) 

            # Print results
            print("CONFIDENCE_SCORE", ab_confidence_score)
            print('Abstractive:::\n%s' % abs_summary)
            print('Extractive:::\n%s' % ext_summary)
            print('Keywords:::')
            for keyword in keywordList:
                print("#%s " % keyword, end="")
            print('\nTrending Keywords:::')
            n = 1
            for keyword in top10_trending:
                print("%d. %s " % (n, keyword), end="")
                n += 1
            print()

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

