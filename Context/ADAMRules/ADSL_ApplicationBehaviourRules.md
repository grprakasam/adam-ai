This file defines the control flow of the front end application

Based on what is given here, the app frontend flow would behave accordingly


**Rules**

After the user uploads the specification, the app should behave in this particular way:

**Behaviour Rule 1 : Show  the Specification Variables in a Categorised manner**

It should first validate that the following fields are present in the specification file based on the below grouping 
It must create a categorised display for the list of variables present in the specification under the column named :'Variable'


**Subject & Study Identifiers**
STUDYID, USUBJID, SUBJID, SITEID, PACKNUM

**Demographics & Subject Characteristics**
AGE, AGEU, AGEA, AGEAU, BRTHDT, BRTHDTF, SEX, SEXN, RACE, RACEN, ETHNIC, ETHNICN, COUNTRY

AGGRy,AGEGRyN,RACEGRy,RACEGRyN

 **Baseline Characteristics & Disease Measures**
HEIGHTBL, WEIGHTBL, BSABL, TOTBSABL, IGASEVBL

 **Treatment & Arm Assignment**
ARM, ARMCD, ACTARM, ACTARMCD

TRTxxP, TRTxxPN, TRTxxA, TRTxxAN

**Dose Variables**
DOSExxP,DOSExxA,DOSExxU

 **Treatment Dates**
RFICDT, RANDDT, TRTSDT, TRTEDT, TRTSDTM, TRTEDTM

**Disposition**
DTHDT, EOSDT, EOSSTTDCSREAS, DTHCAUS

**Population Indicator & Analysis Flags**
SAFFL, COMPLFL, RANDFL, SCRNFFL,FASFL,ITTFL,PPROTFL,COMPLFL,ENRLFL


**Phase Time Variables**
APxxSDT,APxxSTM,APxxETMF,PxxSw,PxxSwSDT,PHwETM,
PHwEDTM


 **Analysis Groupings**
AGEGRy, AGEGRyN, COHORT, SUBGROUP

Note that in the below variable names, whatever in small case will indicate numbers.
for example:
AGGRy -> would incate either AGGR1 or AGGR2 or AGGR3 or like that
TRTxxP -> would indicate TRT01P or TRT02P 0r TRT03P
APxxSDT-> would indicate AP01SDT or AP02SDT 0r AP03SDT

you have to understand and decode the varibles in small cases and then categorise them