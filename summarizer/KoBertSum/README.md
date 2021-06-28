# KOBERT SUMMARIZER
## INSTALL
```sh
cd summarizer/KoBertSum
sh install_requirements.sh
```

## Example
see the example summarizations in example.py

## USE
used in ai-moderator/summarizer/server.py

~~~
from src.test_summarize_string import KOBERT_SUMMARIZER

kobert_model = KOBERT_SUMMARIZER()

for text in source_texts:
    encode = kobert_model.encode(text)
    summaries = kobert_model.generate(encode, sent)
    summary = " ".join(summaries)
~~~
