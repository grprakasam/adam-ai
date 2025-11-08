
This page defines the appliation  behaviour and flow

**Work Flow**

**Input Files:**
The user uploads the specification through the UI , which will be stored in the following location:'Content\UserInputs\ADAMSpecifications\'
The additional references required for ADAM programming is available in  'Content\StandardDocuments\ '. this documents has to be referened based on user instructions


**Approach:**
the tool should understand the vaibales given in each row, apply the programming logic specified in appropriate columns through using API call with a Large Language model
Create a programming logic for the varibale 
Make a user friendly ui interaction to get inputs from user at each stage and buld the program in a logical structured way as defined under the rules in 'Context\ADAMRules\' folder
consolidate the code for all the varibales 

**Expected Final Result:**
Final code for the entire specification , that will be able to create the ADAM dataset 



**How the app must work each time?**
After the user uploads the specification excel , the following must happen:

It should understand the ADAM dataset that has to be created first.
Then  based on the dataset name, the appropriate  programming context and  logic for creating the datasets will be understood  from the contents of 'Context\ADAMRules\' and accordingly the app must present the chat flow

For example if the user wants to create ADSL , the files present under the 'Context\ADAMRules\' must be picked up and all the logics and conditions mentioned in those files would be applied to create the dataset



