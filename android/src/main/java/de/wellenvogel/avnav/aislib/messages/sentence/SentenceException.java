/* Copyright (c) 2011 Danish Maritime Authority.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.wellenvogel.avnav.aislib.messages.sentence;

import java.util.Deque;



/**
 * Exception class for exceptions related to sentences
 */
public class SentenceException extends Exception {

    private static final long serialVersionUID = 1L;

    public SentenceException() {
    }

    public SentenceException(String msg) {
        super(msg);
    }

    private static String join(Deque<String> sentenceTrace){
        StringBuilder sb=new StringBuilder();
        for (String l: sentenceTrace){
            if (sb.length()>0) sb.append("\n");
            sb.append(l);
        }
        return sb.toString();
    }

    public SentenceException(String msg, Deque<String> sentenceTrace) {
        this(msg + "\nSentence trace:\n---\n" + join(sentenceTrace) + "\n---\n");
    }

    public SentenceException(SentenceException e, Deque<String> sentenceTrace) {
        this(e.getMessage(), sentenceTrace);
    }
}
