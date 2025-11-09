This file defines the control flow of the front end application

Based on what is given here, the app frontend flow would behave accordingly


**Rules**

After the user uploads the specification, the app should behave in this particular way:

**Behavior Rule 1 : Show  the Specification Variables in a Categorized manner**

* Understand the variables from the specification excel uploaded by the user
* lookup all the variables under the column named :'Variable' from the specification with reference to the ADAMRules\VariablesMapping.xlsx 
* In the UI section of workspace create a categorized grouping of the variables and based on the groupings defined in the excel sheet and present the information to the user in the front end

The overall idea is to group the variables in a categorized manner so that its easy for the user to understand and confirm the variables to be created in the ADAM dataset

