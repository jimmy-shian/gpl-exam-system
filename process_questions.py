import re
import os
import json

def parse_question(line):
    # Regex to capture question number and answer
    match = re.match(r'^\s*(\d+)\s+([1-4OX])\s+', line)
    if not match:
        return None

    q_num = match.group(1)
    answer = match.group(2)
    # The rest of the line is question, options, and maybe a note
    rest_of_line = line[match.end():].strip()

    # First, extract any notes that are part of the question text itself, e.g., [...]
    question_note_match = re.search(r'\s*[\[(](.+?)[\])]$', rest_of_line.split(' (1)')[0])
    main_note = ''
    if question_note_match:
        main_note = question_note_match.group(1).strip()
        # Remove the note from the question part
        rest_of_line = rest_of_line[:question_note_match.start()]

    # Split the rest of the line by option markers like (1), (2)...
    parts = re.split(r'\s*\([1-4OX]\)\s*', rest_of_line)
    question_text = parts[0].strip()
    final_main_note = main_note.strip()
    if final_main_note:
        question_text += f" [{final_main_note}]"

    options = []
    if len(parts) > 1:
        option_texts = parts[1:]
        for i, opt_text in enumerate(option_texts):
            opt_num = i + 1
            opt_text = opt_text.strip()
            
            if i == len(option_texts) - 1: # Only check for notes in the last option
                note_content = ''
                temp_opt_text = opt_text.strip()

                # Priority 1: Period separator
                if '。' in temp_opt_text:
                    parts = temp_opt_text.split('。', 1)
                    if len(parts) > 1 and parts[1].strip():
                        opt_text = parts[0].strip() + '。'
                        note_content = parts[1].strip()
                
                # Priority 2: Parenthesis separator
                if not note_content:
                    match = re.search(r'\s*\(([^)]+)\)$|\s*（([^）]+)）$', temp_opt_text)
                    if match:
                        note_content = (match.group(1) or match.group(2)).strip()
                        opt_text = temp_opt_text[:match.start()].strip()

                if note_content:
                    question_text += f" [{note_content}]"

            options.append(f"{opt_num}. {opt_text.replace(' ', '')}")

    return {
        'q_num': q_num,
        'answer': answer,
        'question': question_text,
        'options': options
    }

def format_question(q_data):
    formatted_string = f"[{q_data['q_num']}] {q_data['question']}\n\n"
    if q_data['options']:
        cleaned_options = [opt.replace(' ', '') for opt in q_data['options']]
        formatted_string += "\n".join(cleaned_options)
    else: # For O/X questions
        formatted_string += "1. O\n2. X"
    return formatted_string

def process_file(input_path, all_chapters_data):
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: File not found at {input_path}")
        return

    # A chapter title is a line followed by the header line '編\t答 試題...'
    # The (?=...) is a positive lookahead to find the header without consuming it.
    chapter_pattern = re.compile(r'^(.+?)\s*$(?=\n編\t答)', re.MULTILINE)
    chapters = chapter_pattern.split(content)
    chapters = chapters[1:]

    for i in range(0, len(chapters), 2):
        chapter_title = chapters[i].strip()
        chapter_content = chapters[i+1]
        
        lines = chapter_content.strip().split('\n')
        lines = [line for line in lines if '編\t答' not in line and '試題' not in line and line.strip() != '']
        
        questions_data = []
        current_line = ""
        
        for line in lines:
            if re.match(r'^\s*\d+\s+', line):
                if current_line:
                    q_data = parse_question(current_line)
                    if q_data:
                        questions_data.append(q_data)
                current_line = line.strip()
            else:
                current_line += " " + line.strip()
        
        if current_line:
            q_data = parse_question(current_line)
            if q_data:
                questions_data.append(q_data)

        if questions_data:
            if chapter_title not in all_chapters_data:
                all_chapters_data[chapter_title] = []
            all_chapters_data[chapter_title].extend(questions_data)

def main():
    file_paths = [
        'c:\\Users\\Administrator\\Desktop\\html_test\\GPL-MockTest\\garement_Q\\03.2-林文信-題庫選擇114.03.17 conv.txt',
        'c:\\Users\\Administrator\\Desktop\\html_test\\GPL-MockTest\\garement_Q\\03.3-林文信-題庫選擇114.05.01 conv.txt'
    ]
    output_dir = 'c:\\Users\\Administrator\\Desktop\\html_test\\GPL-MockTest\\data'
    all_chapters_data = {}

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    for file_path in file_paths:
        process_file(file_path, all_chapters_data)

    for chapter_title, questions_data in all_chapters_data.items():
        base_name = chapter_title
        if ' 選擇題' in base_name:
            base_name = base_name.replace(' 選擇題', '')
        output_filename = os.path.join(output_dir, f"{base_name}.txt")
        with open(output_filename, 'w', encoding='utf-8') as f_out:
            # Re-number questions before writing
            for i, q in enumerate(questions_data):
                q['q_num'] = str(i + 1)
                f_out.write(format_question(q) + "\n\n")

            # f_out.write("\n" + "-"*20 + "\nAnswers\n" + "-"*20 + "\n") 
            f_out.write("\n\n")
            answer_lines = []
            for i in range(0, len(questions_data), 10):
                chunk = questions_data[i:i+10]
                answer_line = " ".join([f"{q['q_num']}.{q['answer']}" for q in chunk])
                answer_lines.append(answer_line)
            f_out.write("\n".join(answer_lines))
        
        print(f"Processed and merged chapter '{chapter_title}' -> {output_filename}")

def generate_test_list():
    """Scans the 'data' directory for .txt files and creates tests.json."""
    data_dir = 'data'
    output_path = 'tests.json' # Output to root for easy fetching by app.js
    try:
        # Get all .txt files, you might want to exclude some files here
        txt_files = sorted([f for f in os.listdir(data_dir) if f.endswith('.txt')])
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(txt_files, f, ensure_ascii=False, indent=2)
        print(f"\nSuccessfully generated '{output_path}' with {len(txt_files)} test files.")

    except FileNotFoundError:
        print(f"\nError: Directory '{data_dir}' not found. Cannot generate test list.")
    except Exception as e:
        print(f"\nAn error occurred while generating test list: {e}")

def generate_file_list(data_dir, output_path):
    """Scans the data directory for .txt files and generates a JSON file list."""
    try:
        files = [f for f in os.listdir(data_dir) if f.endswith('.txt') and os.path.isfile(os.path.join(data_dir, f))]
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(files, f, ensure_ascii=False, indent=2)
        print(f"Successfully generated file list at {output_path}")
    except Exception as e:
        print(f"Error generating file list: {e}")

if __name__ == "__main__":
    # 1. Process raw question files into separate .txt files in /data
    main()

    # 2. Generate a JSON list of all .txt files in /data for the frontend
    # generate_test_list()

    # After processing questions, generate the file list
    data_directory = os.path.join(os.path.dirname(__file__), 'data')
    output_json_path = os.path.join(data_directory, 'file_list.json')
    generate_file_list(data_directory, output_json_path)
