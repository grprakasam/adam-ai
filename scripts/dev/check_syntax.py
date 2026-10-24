
def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in '{[(':
                stack.append((char, i + 1, j + 1))
            elif char in '}])':
                if not stack:
                    print(f'Error: Unmatched closing {char} at line {i+1}:{j+1}')
                    return
                last, li, lj = stack.pop()
                expected = '{' if char == '}' else '[' if char == ']' else '('
                if last != expected:
                    print(f'Error: Mismatched {char} at line {i+1}:{j+1}. Expected closing for {last} from {li}:{lj}')
                    return
    
    if stack:
        print('Error: Unclosed items:')
        for char, li, lj in stack:
            print(f'  {char} from line {li}:{lj}')

check_braces(r'c:\Users\grpra\OneDrive\Desktop\Nov25\ADAM_AI\ADAMAINov25\frontend\src\components\AdamGeneratorTab.tsx')

