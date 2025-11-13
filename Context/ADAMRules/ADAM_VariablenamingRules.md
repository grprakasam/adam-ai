
**VariableFormat Check**

Variables ending in DT must contain numeric dates
Variables ending in DTM must contain numeric datetime
Variables ending in FL are character flags (Y/N values)
Variables ending in GRy are grouping variables (y = scheme number)
Variables ending in N are numeric equivalents of character variables
Treatment period variables use format TRTxxP/TRTxxA where xx = 01, 02, etc.
Phase variables use format APxxSDT/APxxEDT where xx = 01, 02, etc.


Verify that date variables follow DATE9. format
Ensure datetime variables use DATETIME19. format
Confirm all flag variables contain only Y/N/null values