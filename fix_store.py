
import re

file_path = 'frontend/src/store/projectStore.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the Regex for the bad block. 
# It captures the `isGenerating: {},` up to the end of `resetAdamExecution` block.
# We need to be careful about whitespace.

# The bad block structure observed:
# [whitespace]isGenerating: {},
# [whitespace]},
# [whitespace]})),
#
# [whitespace]setAdamExecution: ...
# ...
# [whitespace]})),

regex = r'isGenerating: \{\},\s*\},?\s*\}\)\),\s+setAdamExecution: \(executionState\) =>\s+set\(\(state\) => \(\{\s+adamExecution: \{\s+\.\.\.state\.adamExecution,\s+\.\.\.executionState,\s+\},\s+\}\)\),\s+resetAdamExecution: \(\) =>\s+set\(\(state\) => \(\{\s+adamExecution: \{\s+\.\.\.initialState\.adamExecution,\s+\},\s+\}\)\),'

# Compile regex with DOTALL to match newlines? No, explicit \s+ matches newlines.
# But let's verify.

# Let's try a simpler approach. Split the file by the bad block signature.
# "isGenerating: {}," seems unique to my error? 
# "setAdamExecution: (executionState) =>" appears many times now.

# We will replace the entire matched block with just `})),`.
# Since I used `AllowMultiple: true` in replace_file_content, the indentation of `})),` might be different for each.
# The regex should capture the PRECEDING closing brace/paren if needed?
# No, my replace replaced `})),` with the block. So I should put `})),` back.

fixed_content = re.sub(regex, '})),', content, flags=re.MULTILINE | re.DOTALL)

# Now, we also need to add the Real `setAdamExecution` at the end of the store definition.
# It should be before the LAST `})),`? No, inside `create<ProjectStore>()(...)`.
# The file ends with `export const useProjectStore ...`.
# We simply need to find a good place to insert it.
# Ideally, near the end of the `subscribeWithSelector(persist((set, get) => ({ ...` block.
# The actions end around line 1700 (before the mess).

# Provide the snippet for setAdamExecution
new_actions = """
        setAdamExecution: (executionState) =>
          set((state) => ({
            adamExecution: {
              ...state.adamExecution,
              ...executionState,
            },
          })),

        resetAdamExecution: () =>
          set((state) => ({
            adamExecution: {
              ...initialState.adamExecution,
            },
          })),
"""

# Insert it before the last closing brace of the main object return.
# We can look for `clearCodeReview: () => void;` which is in the interface? No.
# Usage: `loadCodeReviewSession: ...`
# Let's search for `loadCodeReviewSession` and insert after its block.
# But `loadCodeReviewSession` is also long.

# Let's just fix the corruption first.
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print("Fixed syntax errors.")
