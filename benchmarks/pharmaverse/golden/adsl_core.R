# ---------------------------------------------------------------------------
# Golden reference program: ADSL core variables from pharmaversesdtm
#
# Purpose : Deterministic "replay" program used by the benchmark in CI. It lets
#           the pipeline (validate -> execute -> compare) be tested end to end
#           without an LLM API key. Live runs replace this with model output.
# Contract: SDTM domains are pre-loaded as data frames named dm, ex, ds.
#           The program must create a data frame named `adsl`.
# Packages: dplyr, lubridate (loaded by the runner)
# ---------------------------------------------------------------------------

to_date <- function(x) {
  x <- substr(as.character(x), 1, 10)
  x[is.na(x) | nchar(x) < 10] <- NA_character_
  as.Date(x, format = "%Y-%m-%d")
}

# Valid exposure: active dose > 0, or placebo given at dose 0 (admiral convention)
ex_valid <- ex %>%
  mutate(
    EXDOSE = suppressWarnings(as.numeric(EXDOSE)),
    EXSTDT = to_date(EXSTDTC),
    EXENDT = to_date(EXENDTC)
  ) %>%
  filter(EXDOSE > 0 | (EXDOSE == 0 & grepl("PLACEBO", toupper(EXTRT))))

trt_start <- ex_valid %>%
  filter(!is.na(EXSTDT)) %>%
  group_by(USUBJID) %>%
  summarise(TRTSDT = min(EXSTDT), .groups = "drop")

trt_end <- ex_valid %>%
  filter(!is.na(EXENDT)) %>%
  group_by(USUBJID) %>%
  summarise(TRTEDT = max(EXENDT), .groups = "drop")

exposed <- ex_valid %>% distinct(USUBJID) %>% mutate(.exposed = TRUE)

disposition <- ds %>%
  filter(DSCAT == "DISPOSITION EVENT") %>%
  mutate(
    EOSSTT = case_when(
      DSDECOD == "COMPLETED" ~ "COMPLETED",
      DSDECOD == "SCREEN FAILURE" ~ NA_character_,
      !is.na(DSDECOD) ~ "DISCONTINUED"
    ),
    EOSDT = if_else(DSDECOD == "SCREEN FAILURE", as.Date(NA), to_date(DSSTDTC))
  ) %>%
  group_by(USUBJID) %>%
  slice_tail(n = 1) %>%
  ungroup() %>%
  select(USUBJID, EOSSTT, EOSDT)

randomized <- ds %>%
  filter(DSDECOD == "RANDOMIZED") %>%
  mutate(RANDDT = to_date(DSSTDTC)) %>%
  group_by(USUBJID) %>%
  summarise(RANDDT = min(RANDDT), .groups = "drop")

adsl <- dm %>%
  select(
    STUDYID, USUBJID, SUBJID, SITEID, COUNTRY, AGE, AGEU, SEX, RACE, ETHNIC,
    ARM, ARMCD, ACTARM, ACTARMCD, RFSTDTC, RFENDTC, DTHFL, DTHDTC
  ) %>%
  mutate(
    AGE = suppressWarnings(as.numeric(AGE)),
    AGEGR1 = case_when(
      is.na(AGE) ~ NA_character_,
      AGE < 18 ~ "<18",
      AGE <= 64 ~ "18-64",
      TRUE ~ ">64"
    ),
    TRT01P = ARM,
    TRT01A = ACTARM,
    DTHDT = to_date(DTHDTC)
  ) %>%
  left_join(trt_start, by = "USUBJID") %>%
  left_join(trt_end, by = "USUBJID") %>%
  left_join(exposed, by = "USUBJID") %>%
  left_join(disposition, by = "USUBJID") %>%
  left_join(randomized, by = "USUBJID") %>%
  mutate(
    TRTDURD = if_else(
      !is.na(TRTSDT) & !is.na(TRTEDT),
      as.numeric(TRTEDT - TRTSDT) + 1,
      NA_real_
    ),
    SAFFL = if_else(!is.na(.exposed), "Y", "N")
  ) %>%
  select(-.exposed, -DTHDTC)
