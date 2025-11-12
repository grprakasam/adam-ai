Goal 

Do the following enhancement to the codebase


I want the ui design as below:

When the user comes to each page and makes the changes in the variables for that section, there should be a progress bar that marks the percentage of completion of the activity

The percentage is measured by how many variables the user has clicked on the "Approve" Button
For example, if there are 100 variables in the specification and the user has selected 25 "approve" check box across the different vertical tabs, then the progress should be displayed as 25 percent in a progress indicator

suppose he unchecks something and the count of approved , comes down or comes up , then the progress should be indicated accordingly

This progress bar should always be visible and preferable placed at the bottom section in a visually better way to intuitively understand the progress of the pair programming

The ultimate goal is to ensure that the user is able to understand how much of the variable confirmation activity is completed and how much is pending

then the next feature would be to enable the "Generate ADAM Code" button only when the progress reaches 80 percent or more

the "Generate ADAM Code" button should be disabled until the progress reaches 80 percent or more

the progress bar should be updated in real time as the user makes changes to the approve checkboxes across different vertical tabs

the progress bar should be visually appealing and easy to understand

the progress bar should also have a tooltip or label indicating the exact percentage of completion when hovered over


**Code generation**

the "Generate ADAM Code" button should have a tooltip indicating that it will be enabled once 80 percent of variables are approved

the progress bar and the button should be responsive and work well on different screen sizes and devices

Once the user has approved 80 percent or more of the variables, the "Generate ADAM Code" button should become enabled and clickable.

after the click , the button should show a loading indicator until the code generation process is complete

the code should be generated as per the existing workflow defined in the application and also the project requirements

The code to be generated will be a final consolidated code for all the variables that were approved by the user in the categorized tabs with proper comments indicating which variable's code is being generated

Note that if the user has entered something in the 	User Notes section for any variable, that should also be taken into consideration while generating the code for that variable. this should be properly understood and reflected in the generated code

If possible , before generating the final code, do a quick check of the user inputs from the User Notes section to see if there are any conflicting instructions or conditions provided by the user that may impact the code generation. if found, provide a warning message to the user to review their notes before proceeding with code generation

please ensure that each and every variable if there are any specific instructions in the User Notes section are properly reflected in the generated code for that variable



When the user clicks on the "Generate ADAM Code" button, it should trigger the code generation process as defined in the existing workflow

before the code is generated, give a high level outline of the steps that will be taken to generate the code based on the approved variables and any user notes provided. ask for the user's confirmation to proceed with the code generation.


ask for user preference of packages if in r and any proc specifics if in sas ., create the code generation accordingly

Do this a a better user experience step to ensure that the user is aware of what will happen next

Ensure that appropriate feedback is given to the user when the button is clicked, such as a loading indicator or success message once the code generation is complete


the generated final code must be displayed in the code output section as per the existing design
The generated code must include only the variables that were approved by the user

the generated code must be properly formatted and include comments indicating which variable's code is being generated

the code generation process must handle any errors gracefully and provide appropriate feedback to the user if something goes wrong

the generated code must be as per the industry standards for ADAM programming
Please make the necessary code changes to implement the above features in the codebase.Please ensure to test the changes thoroughly to verify that the progress bar and button behave as expected and that the generated code meets the specified requirements.


in all of the above changes , please ensure that the existing features of the application are not broken and everything works as expected.

also if there is a better way to implement the above features than what is described, please feel free to do so as long as the end result meets the specified requirements.

my ultimate goal is to have a seamless user experience for the ADAM program generation process leveraging AI pair programming capabilities.


Please implement the above changes in the codebase.