
export type BadgeItem = string | { label: string; badge: string };

export interface Category {
  title: string;
  items: BadgeItem[];
}

export const PLAYER_CATEGORIES: Category[] = [
  {
    title: "FOOTBALL BABY",
    items: [
      "Rejestracja w systemie",
      "Obecność na treningu",
      "Całkowite wypełnienie profilu zawodnika (ze zdjęciem)",
      "Dodanie zdjęcia profilowego",
      { label: "Puchar wzorowego zawodnika", badge: "wzorowy zawodnik Football Baby" },
      "Obecność na treningu wakacyjnym",
      { label: "Zapis do Football Academy", badge: "absolwent Football Baby" },
      { label: "Najbardziej uśmiechnięty zawodnik", badge: "Najbardziej uśmiechnięty zawodnik" }
    ]
  },
  {
    title: "FOOTBALL ACADEMY",
    items: [
      { label: "Rejestracja w systemie", badge: "Zawodnik Football Academy" },
      "Obecność na treningu",
      "Całkowite wypełnienie profilu zawodnika",
      "Dodanie zdjęcia profilowego",
      { label: "Puchar wzorowego zawodnika", badge: "wzorowy zawodnik Football Academy" },
      { label: "Medal FA MOTIVATION - wzór postępu", badge: "Wzór FA MOTIVATION" },
      { label: "Medal FA MOTIVATION - wzór zachowania", badge: "Wzór FA MOTIVATION" },
      { label: "Medal FA MOTIVATION - wzór fair-play", badge: "Wzór FA MOTIVATION" },
      "Obecność na treningu wakacyjnym",
      { label: "100% obecności w danym miesiącu", badge: "Wzór frekwencji" },
      { label: "100% obecności w danym sezonie", badge: "Mistrz frekwencji" },
      "Organizacja urodzin FA",
      "Urodziny na treningu",
      { label: "przejście z grupy Beckham do grupy Owen", badge: "Przejście do grupy Owen" },
      { label: "przejście z grupy Owen do grupy Lampard", badge: "Przejście do grupy Lampard" },
      { label: "przejście z grupy Lampard do grupy Rooney", badge: "Przejście do grupy Rooney" },
      { label: "absolwent Football Academy", badge: "Absolwent Football Academy" },
      { label: "Aktywny w social mediach", badge: "aktywny w social mediach" },
      { label: "Najbardziej uśmietnięty zawodnik", badge: "Najbardziej uśmiechnięty zawodnik" },
      "Udział zawodnika w treningu pokazowym",
      "Udział w turnieju",
      "Udział w meczu towarzystkim",
      "Udział w meczu ligowym"
    ]
  },
  {
    title: "FA CAMPS",
    items: [
      "Udział w półkolonii",
      "Udział w obozie dochodzeniowym",
      { label: "Udział w obozie krajowym", badge: "Krajowy obozowicz FA" },
      { label: "Udział w obozie zagranicznym", badge: "Zagraniczny obozowicz FA" },
      "Udział w wycieczce",
      "Udział w zgrupowaniu weekendowym",
      { label: "Wyróżnienie indywidualne na obozie", badge: "Wzorowy obozowicz FA Camps" },
      { label: "Nagroda \"czyściocha obozowego\"", badge: "czyścioch obozowy FA Camps" },
      { label: "Wyróżnienie indywidualne na półkolonii", badge: "Wzorowy półkolonista FA Camps" },
      "Wyróżnienie indywidualne na obozie dochodzeniowym",
      "Udział w kolejnym obozie danego zawodnika"
    ]
  },
  {
    title: "PONAD MIARĘ",
    items: [
      "Udział w testach",
      { label: "Zawodnik FA Sole", badge: "Zawodnik FA Sole" },
      { label: "Zawodnik Goalkeepers Academy", badge: "Zawodnik Goalkeepers Academy" },
      "Challenge I miejsce",
      "Challenge II miejsce",
      "Challenge III miejsce",
      { label: "Zwód 1 - Ronaldinho poziom początkujący (Owen)", badge: "Początkujący drybler" },
      { label: "Zwód 1 - Ronaldinho poziom średniozaawansowany (Owen)", badge: "Wprawny drybler" },
      { label: "Zwód 1 - Ronaldinho poziom zaawansowany (Owen)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 1 - Ronaldinho poziom ekspert (Owen)", badge: "Mistrz dryblingu" },
      { label: "Zwód 2 - Robinho poziom początkujący (Owen)", badge: "Początkujący drybler" },
      { label: "Zwód 2 - Robinho poziom średniozaawansowany (Owen)", badge: "Wprawny drybler" },
      { label: "Zwód 2 - Robinho poziom zaawansowany (Owen)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 2 - Robinho poziom ekspert (Owen)", badge: "Mistrz dryblingu" },
      { label: "Zwód 3 - Neymar poziom początkujący (Owen)", badge: "Początkujący drybler" },
      { label: "Zwód 3 - Neymar poziom średniozaawansowany (Owen)", badge: "Wprawny drybler" },
      { label: "Zwód 3 - Neymar poziom zaawansowany (Owen)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 3 - Neymar poziom ekspert (Owen)", badge: "Mistrz dryblingu" },
      { label: "Zwód 4 - Figo poziom początkujący (Owen)", badge: "Początkujący drybler" },
      { label: "Zwód 4 - Figo poziom średniozaawansowany (Owen)", badge: "Wprawny drybler" },
      { label: "Zwód 4 - Figo poziom zaawansowany (Owen)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 4 - Figo poziom ekspert (Owen)", badge: "Mistrz dryblingu" },
      { label: "Zwód 5 - Messi poziom początkujący (Owen)", badge: "Początkujący drybler" },
      { label: "Zwód 5 - Messi poziom średniozaawansowany (Owen)", badge: "Wprawny drybler" },
      { label: "Zwód 5 - Messi poziom zaawansowany (Owen)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 5 - Messi poziom ekspert (Owen)", badge: "Mistrz dryblingu" },
      { label: "Zwód 1 - Busquets poziom początkujący (Lampard)", badge: "Początkujący drybler" },
      { label: "Zwód 1 - Busquets poziom średniozaawansowany (Lampard)", badge: "Wprawny drybler" },
      { label: "Zwód 1 - Busquets poziom zaawansowany (Lampard)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 1 - Busquets poziom ekspert (Lampard)", badge: "Mistrz dryblingu" },
      { label: "Zwód 2 - Ronaldo poziom początkujący (Lampard)", badge: "Początkujący drybler" },
      { label: "Zwód 2 - Ronaldo poziom średniozaawansowany (Lampard)", badge: "Wprawny drybler" },
      { label: "Zwód 2 - Ronaldo poziom zaawansowany (Lampard)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 2 - Ronaldo poziom ekspert (Lampard)", badge: "Mistrz dryblingu" },
      { label: "Zwód 3 - Ibrahimovic poziom początkujący (Lapmard)", badge: "Początkujący drybler" },
      { label: "Zwód 3 - Ibrahimovic poziom średniozaawansowany (Lapmard)", badge: "Wprawny drybler" },
      { label: "Zwód 3 - Ibrahimovic poziom zaawansowany (Lapmard)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 3 - Ibrahimovic poziom ekspert (Lapmard)", badge: "Mistrz dryblingu" },
      { label: "Zwód 1 - Zidane poziom początkujący (Rooney)", badge: "Początkujący drybler" },
      { label: "Zwód 1 - Zidane poziom średniozaawansowany (Rooney)", badge: "Wprawny drybler" },
      { label: "Zwód 1 - Zidane poziom zaawansowany (Rooney)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 1 - Zidane poziom ekspert (Rooney)", badge: "Mistrz dryblingu" },
      { label: "Zwód 2 - Cruyff poziom początkujący (Rooney)", badge: "Początkujący drybler" },
      { label: "Zwód 2 - Cruyff poziom średniozaawansowany (Rooney)", badge: "Wprawny drybler" },
      { label: "Zwód 2 - Cruyff poziom zaawansowany (Rooney)", badge: "Wschodząca gwiazda dryblingu" },
      { label: "Zwód 2 - Cruyff poziom ekspert (Rooney)", badge: "Mistrz dryblingu" }
    ]
  },
  {
    title: "MISTRZOSTWA POLSKI FA",
    items: [
      "Udział w etapie mikroregionalnym Mistrzostw Polski FA",
      "Każda zdobyta bramka lub czyste konto w etapie mikroregionalnym Mistrzostw Polski FA",
      "Udział w etapie makroregionalnym Mistrzostw Polski FA",
      "Każda zdobyta bramka lub czyste konto w etapie makroregionalnym Mistrzostw Polski FA",
      { label: "Udział w finale centralnym Mistrzostw Polski FA", badge: "finalista Mistrzostw Polski FA" },
      "Każda zdobyta bramka lub czyste konto w finale centralnym Mistrzostw Polski FA",
      { label: "Brązowy medal Mistrzostw Polski FA", badge: "II wicemistrz Polski FA" },
      { label: "Srebrny medal Mistrzostw Polski FA", badge: "wicemistrz Polski FA" },
      { label: "Złoty medal Mistrzostw Polski FA", badge: "mistrz Polski FA" },
      "Wyróżnienie indywidualne MPFA",
      { label: "Najlepszy zawodnik Mistrzostw Polski FA", badge: "najlepszy zawodnik Mistrzostw Polski FA" },
      { label: "Król strzelców Mistrzostw Polski FA", badge: "król strzelców Mistrzostw Polski FA" },
      "Najlepszy obrońca Mistrzostw Polski FA",
      { label: "Najlepszy bramkarz Mistrzostw Polski FA", badge: "najlepszy bramkarz Mistrzostw Polski FA" }
    ]
  },
  {
    title: "KADRA REGIONALNA FA",
    items: [
      { label: "Udział w konsultacji Kadry Regionalnej FA", badge: "Kadrowicz Regionalny FA" },
      "Powołanie na Turniej Kadr Regionalnych FA",
      { label: "Udział w Turnieju Kadr Regionalnych FA", badge: "Finalista Turnieju Kadr Regionalnych" },
      { label: "Brązowy medal Turnieju Kadr Regionalnych FA", badge: "II wicemistrz regionalny FA" },
      { label: "Srebrny medal Turnieju Kadr Regionalnych FA", badge: "wicemistrz regionalny FA" },
      { label: "Złoty medal Turnieju Kadr Regionalnych FA", badge: "mistrz regionalny FA" },
      "Wyróżnienie indywidualne na Turnieju Kadr Regionalnych",
      { label: "Najlepszy zawodnik Turnieju Kadr Regionalnych FA", badge: "Najlepszy zawodnik Turnieju Kadr Regionalnych FA" },
      { label: "Król strzelców Turnieju Kadr Regionalnych FA", badge: "Król strzelców Turnieju Kadr Regionalnych FA" },
      "Najlepszy obrońca Turnieju Kadr Regionalnych FA",
      { label: "Najlepszy bramkarz Turnieju Kadr Regionalnych FA", badge: "Najlepszy bramkarz Turnieju Kadr Regionalnych FA" }
    ]
  },
  {
    title: "KADRA POLSKI FA",
    items: [
      { label: "Powołanie do Kadry Polski FA", badge: "kadrowicz Polski FA" },
      "Udział w konsultacji Kadry Polski FA",
      "Udział w turnieju Kadry Polski FA",
      "Udział w zgrupowaniu Kadry Polski FA",
      { label: "Udział w obozie Kadry Polski FA", badge: "obozowicz Kadry Polski FA" }
    ]
  },
  {
    title: "TURNIEJE ZEWNĘTRZNE",
    items: [
      { label: "Udział w finale Deichmanna", badge: "finalista Deichmanna" },
      { label: "Brązowy medal Deichmanna", badge: "II wicemistrz Deichmanna" },
      { label: "Srebrny medal Deichmanna", badge: "wicemistrz Deichmanna" },
      { label: "Złoty medal Deichmanna", badge: "mistrz Deichmanna" },
      { label: "Najlepszy zawodnik Deichmanna", badge: "najlepszy zawodnik Deichmanna" },
      { label: "Król strzelców Deichmanna", badge: "król strzelców Deichmanna" },
      { label: "Najlepszy bramkarz Deichmanna", badge: "najlepszy bramkarz Deichmanna" },
      { label: "Udział w finale Tymbarka", badge: "finalista Tymbarka" },
      { label: "Brązowy medal Tymbarka", badge: "II wicemistrz Tymbarka" },
      { label: "Srebrny medal Tymbarka", badge: "wicemistrz Tymbarka" },
      { label: "Złoty medal Tymbarka", badge: "mistrz Tymbarka" },
      { label: "Najlepszy zawodnik Tymbarka", badge: "najlepszy zawodnik Tymbarka" },
      { label: "Król strzelców Tymbarka", badge: "król strzelców Tymbarka" },
      { label: "Najlepszy bramkarz Tymbarka", badge: "najlepszy bramkarz Tymbarka" },
      { label: "Udział w finale o Pucharu Prezesa PZPN", badge: "finalista Pucharu Prezesa PZPN" },
      { label: "Brązowy medal Pucharu Prezesa PZPN", badge: "II wicemistrz Pucharu Prezesa PZPN" },
      { label: "Srebrny medal Pucharu Prezesa PZPN", badge: "wicemistrz Pucharu Prezesa PZPN" },
      { label: "Złoty medal Pucharu Prezesa PZPN", badge: "mistrz Pucharu Prezesa PZPN" },
      { label: "Najlepszy zawodnik Pucharu Prezesa PZPN", badge: "najlepszy zawodnik Pucharu Prezesa PZPN" },
      { label: "Król strzelców Pucharu Prezesa PZPN", badge: "król strzelców Pucharu Prezesa PZPN" },
      { label: "Najlepszy bramkarz Pucharu Prezesa PZPN", badge: "najlepszy bramkarz Pucharu Prezesa PZPN" },
      "Wyróżnienie indywidualne",
      { label: "Powołanie do Kadry Województwa PZPN", badge: "kadrowicz województwa PZPN" },
      { label: "Powołanie na LAMO", badge: "kadrowicz LAMO" },
      { label: "Powołanie na ZAMO", badge: "kadrowicz ZAMO" },
      { label: "Powołanie na WAMO", badge: "kadrowicz WAMO" },
      { label: "Powołanie na JAMO", badge: "kadrowicz JAMO" },
      { label: "Powołanie na Talent PRO", badge: "TALENT PRO" }
    ]
  },
  {
    title: "FASE",
    items: [
      { label: "Udział w \"Dniach Próby\"", badge: "aplikant FASE" }
    ]
  },
  {
    title: "FA SHOP",
    items: [
      "Każde wydane 10 zł przez rodzica"
    ]
  },
  {
    title: "APLIKACJA MOBILNA",
    items: [
      "Instalacja",
      "Przeczytanie newsa ogólnego",
      "Przeczytanie newsa edukacyjnego"
    ]
  }
];

export const COACH_CATEGORIES: Category[] = [
  {
    title: "FOOTBALL BABY",
    items: [
      "Obecność trenera na treningu"
    ]
  },
  {
    title: "FOOTBALL ACADEMY",
    items: [
      "Obecność trenera na treningu",
      "Sprawdzenie obecności dla całej grupy treningowej"
    ]
  },
  {
    title: "FA CAMPS",
    items: [
      "Udział w półkolonii - funkcja trenera",
      "Udział w półkolonii - funkcja kierownika",
      { label: "Udział w obozie - funkcja trenera", badge: "trener obozowy FA" },
      "Udział w obozie - funkcja kierownika",
      "Udział w obozie dochodzeniowym - funkcja trenera",
      "Udział w obozie dochodzeniowym - funkcja kierownika",
      "Udział w obozie Kadry Polski - funkcja trenera",
      "Udział w obozie Kadry Polski - funkcja kierownika",
      "Udział w obozie zagranicznym - funkcja trenera",
      "Udział w obozie zagranicznym - funkcja kierownika",
      "Udział w wycieczce - funkcja trenera",
      "Udział w wycieczce - funkcja kierownika",
      "Udział w zgrupowaniu weekendowym - fukcja trenera",
      "Udział w zgrupowaniu weekendowym - funkcja kierownika"
    ]
  },
  {
    title: "TESTY FA",
    items: [
      "Wprowadzenie wyników testów do systemu",
      { label: "Trener FA Sole", badge: "Trener FA Sole" },
      { label: "Trener Goalkeepers Academy", badge: "Trener Goalkeepers Academy" }
    ]
  },
  {
    title: "MISTRZOSTWA POLSKI FA",
    items: [
      "Udział w etapie mikroregionalnym Mistrzostw Polski FA",
      "Każda zdobyta bramka lub czyste konto w etapie mikroregionalnym Mistrzostw Polski FA",
      "Udział w etapie makroregionalnym Mistrzostw Polski FA",
      "Każda zdobyta bramka lub czyste konto w etapie makroregionalnym Mistrzostw Polski FA",
      { label: "Udział w finale centralnym Mistrzostw Polski FA", badge: "finalista Mistrzostw Polski FA" },
      "Każda zdobyta bramka lub czyste konto w finale centralnym Mistrzostw Polski FA",
      { label: "Brązowy medal Mistrzostw Polski FA", badge: "II wicemistrz Polski FA" },
      { label: "Srebrny medal Mistrzostw Polski FA", badge: "wicemistrz Polski FA" },
      { label: "Złoty medal Mistrzostw Polski FA", badge: "mistrz Polski FA" },
      "Wyróżnienie indywidualne MPFA",
      { label: "Najlepszy zawodnik Mistrzostw Polski FA", badge: "najlepszy zawodnik Mistrzostw Polski FA" },
      { label: "Król strzelców Mistrzostw Polski FA", badge: "król strzelców Mistrzostw Polski FA" },
      "Najlepszy obrońca Mistrzostw Polski FA",
      { label: "Najlepszy bramkarz Mistrzostw Polski FA", badge: "najlepszy bramkarz Mistrzostw Polski FA" }
    ]
  },
  {
    title: "KADRA REGIONALNA FA",
    items: [
      { label: "Udział w konsultacji Kadry Regionalnej FA", badge: "Kadrowicz Regionalny FA" },
      "Powołanie na Turniej Kadr Regionalnych FA",
      { label: "Udział w Turnieju Kadr Regionalnych FA", badge: "Finalista Turnieju Kadr Regionalnych" },
      { label: "Brązowy medal Turnieju Kadr Regionalnych FA", badge: "II wicemistrz regionalny FA" },
      { label: "Srebrny medal Turnieju Kadr Regionalnych FA", badge: "wicemistrz regionalny FA" },
      { label: "Złoty medal Turnieju Kadr Regionalnych FA", badge: "mistrz regionalny FA" },
      "Wyróżnienie indywidualne na Turnieju Kadr Regionalnych",
      { label: "Najlepszy zawodnik Turnieju Kadr Regionalnych FA", badge: "Najlepszy zawodnik Turnieju Kadr Regionalnych FA" },
      { label: "Król strzelców Turnieju Kadr Regionalnych FA", badge: "Król strzelców Turnieju Kadr Regionalnych FA" },
      "Najlepszy obrońca Turnieju Kadr Regionalnych FA",
      { label: "Najlepszy bramkarz Turnieju Kadr Regionalnych FA", badge: "Najlepszy bramkarz Turnieju Kadr Regionalnych FA" }
    ]
  },
  {
    title: "KADRA POLSKI FA",
    items: [
      { label: "Powołanie do Kadry Polski FA", badge: "kadrowicz Polski FA" },
      "Udział w konsultacji Kadry Polski FA",
      "Udział w turnieju Kadry Polski FA",
      "Udział w zgrupowaniu Kadry Polski FA",
      { label: "Udział w obozie Kadry Polski FA", badge: "obozowicz Kadry Polski FA" }
    ]
  },
  {
    title: "TURNIEJE ZEWNĘTRZNE",
    items: [
      { label: "Udział w finale Deichmanna", badge: "finalista Deichmanna" },
      { label: "Brązowy medal Deichmanna", badge: "II wicemistrz Deichmanna" },
      { label: "Srebrny medal Deichmanna", badge: "wicemistrz Deichmanna" },
      { label: "Złoty medal Deichmanna", badge: "mistrz Deichmanna" },
      { label: "Najlepszy zawodnik Deichmanna", badge: "najlepszy zawodnik Deichmanna" },
      { label: "Król strzelców Deichmanna", badge: "król strzelców Deichmanna" },
      { label: "Najlepszy bramkarz Deichmanna", badge: "najlepszy bramkarz Deichmanna" },
      { label: "Udział w finale Tymbarka", badge: "finalista Tymbarka" },
      { label: "Brązowy medal Tymbarka", badge: "II wicemistrz Tymbarka" },
      { label: "Srebrny medal Tymbarka", badge: "wicemistrz Tymbarka" },
      { label: "Złoty medal Tymbarka", badge: "mistrz Tymbarka" },
      { label: "Najlepszy zawodnik Tymbarka", badge: "najlepszy zawodnik Tymbarka" },
      { label: "Król strzelców Tymbarka", badge: "król strzelców Tymbarka" },
      { label: "Najlepszy bramkarz Tymbarka", badge: "najlepszy bramkarz Tymbarka" },
      { label: "Udział w finale o Pucharu Prezesa PZPN", badge: "finalista Pucharu Prezesa PZPN" },
      { label: "Brązowy medal Pucharu Prezesa PZPN", badge: "II wicemistrz Pucharu Prezesa PZPN" },
      { label: "Srebrny medal Pucharu Prezesa PZPN", badge: "wicemistrz Pucharu Prezesa PZPN" },
      { label: "Złoty medal Pucharu Prezesa PZPN", badge: "mistrz Pucharu Prezesa PZPN" },
      { label: "Najlepszy zawodnik Pucharu Prezesa PZPN", badge: "najlepszy zawodnik Pucharu Prezesa PZPN" },
      { label: "Król strzelców Pucharu Prezesa PZPN", badge: "król strzelców Pucharu Prezesa PZPN" },
      { label: "Najlepszy bramkarz Pucharu Prezesa PZPN", badge: "najlepszy bramkarz Pucharu Prezesa PZPN" },
      "Wyróżnienie indywidualne",
      { label: "Powołanie do Kadry Województwa PZPN", badge: "kadrowicz województwa PZPN" },
      { label: "Powołanie na LAMO", badge: "kadrowicz LAMO" },
      { label: "Powołanie na ZAMO", badge: "kadrowicz ZAMO" },
      { label: "Powołanie na WAMO", badge: "kadrowicz WAMO" },
      { label: "Powołanie na JAMO", badge: "kadrowicz JAMO" },
      { label: "Powołanie na Talent PRO", badge: "TALENT PRO" }
    ]
  },
  {
    title: "FASE",
    items: [
      { label: "Udział w \"Dniach Próby\"", badge: "aplikant FASE" }
    ]
  },
  {
    title: "APLIKACJA MOBILNA",
    items: [
      "Instalacja",
      "Przeczytanie newsa ogólnego",
      "Przeczytanie newsa edukacyjnego"
    ]
  },
  {
    title: "UPRAWNIENIA TRENERSKIE",
    items: [
      { label: "Uzyskanie licencji FA", badge: "trener licencjonowany FA" },
      { label: "Posiadanie lincencji UEFA C", badge: "trener UEFA C" },
      { label: "Posiadanie lincencji UEFA B", badge: "trener UEFA B" },
      { label: "Posiadanie lincencji UEFA A", badge: "trener UEFA A" },
      { label: "Posiadanie lincencji UEFA Elite Youth A", badge: "trener UEFA Elite Youth A" },
      { label: "Posiadanie lincencji UEFA PRO", badge: "trener UEFA PRO" }
    ]
  },
  {
    title: "UDZIAŁ W WYDARZENIACH",
    items: [
      "Udział w treningu pokazowym FA",
      "Udział w Lech Conference",
      "Udział w Football Academy Conference",
      "Udział w Konwencie FA",
      "Udział w stażu krajowym FA",
      "Udział w stażu zagranicznym FA",
      "Udział w Webinarze FA"
    ]
  },
  {
    title: "NOMINACJE/NAGRODY",
    items: [
      "Nominacja na Konwencie FA",
      { label: "Nagroda na Konwencie FA", badge: "Nagroda na Konwencie FA" },
      { label: "Nominacja na trenera regionalnego FA", badge: "Trener regionalny FA" },
      { label: "Nominacja na trenera Kadry Polski FA", badge: "Trener Kadry Polski FA" },
      { label: "Nominacja na członka Rady Trenerów", badge: "Członek Rady Trenerów FA" }
    ]
  }
];

export const MANAGER_CATEGORIES: Category[] = [
  {
    title: "OTWARCIE OŚRODKA",
    items: [
      "Otwarcie oddziału Football Academy",
      "Otwarcie oddziału Football Baby",
      "Otwarcie oddziału Goalkeepers Academy",
      { label: "Otwarcie piątego oddziału", badge: "Mini sieć Football Academy" }
    ]
  },
  {
    title: "LICZBA ZAWODNIKÓW",
    items: [
      { label: "Osiągnięcie liczby 50 zawodników", badge: "50 zawodników" },
      { label: "Osiągnięcie liczby 100 zawodników", badge: "100 zawodników" },
      { label: "Osiągnięcie liczby 200 zawodników", badge: "200 zawodników" },
      { label: "Osiągnięcie liczby 250 zawodników", badge: "250 zawodników" },
      { label: "Osiągnięcie liczby 300 zawodników", badge: "300 zawodników" },
      { label: "Osiągnięcie liczby 400 zawodników", badge: "400 zawodników" },
      { label: "Osiągnięcie liczby 500 zawodników", badge: "500 zawodników" }
    ]
  },
  {
    title: "STAŻ OŚRODKA",
    items: [
      "Każdy rok działania ośrodka",
      { label: "5 lat ośrodka", badge: "5 lat ośrodka" },
      { label: "10 lat ośrodka", badge: "10 lat ośrodka" }
    ]
  },
  {
    title: "STANDARDY FA",
    items: [
      "Pełne dane managera (ze zdjęciem)",
      "Pełne dane trenerów (ze zdjęciem)",
      "Grupy treningowe (uzupełnione wszystkie dane ze zdjęciem)",
      "Obiekty treningowe (uzupełnione wszystkie dane ze zdjęciem)",
      "Treningi (dodanie treningu w harmonogramie)",
      "Pierwsza aktualność",
      "Publikacja każdej aktualności na podstronie oddziału",
      { label: "Uzyskanie statusu ośrodka licencjonowanego FA", badge: "ośrodek licencjonowany FA" },
      "Absolwenci Football Baby w ośrodku",
      { label: "Posiadanie wszystkich grup treningowych od Beckhama do Rooneya", badge: "od Beckhama do Rooneya" },
      { label: "Absolwent Football Academy", badge: "Absolwent Football Academy" },
      { label: "Prowadzenie FA Juniors", badge: "FA Juniors" },
      "Prowadzenie FA Sole",
      "Zapis zawodnika",
      "Aktywacja zawodnika w systemie",
      "Saldo na koniec miesiąca poniżej 100 zł"
    ]
  },
  {
    title: "APLIKACJA MOBILNA",
    items: ["Instalacja"]
  },
  {
    title: "MISTRZOSTWA POLSKI FA",
    items: [
      "Organizacja turnieju na etapie mikroregionalnym",
      "Organizacja turnieju na etapie makroregionalnym",
      { label: "Udział drużyny w finale centralnym Mistrzostw Polski FA", badge: "finalista Mistrzostw Polski FA" },
      { label: "Brązowy drużyny w finale centralnym Mistrzostw Polski FA", badge: "II wicemistrz Polski FA" },
      { label: "Srebrny drużyny w finale centralnym Mistrzostw Polski FA", badge: "wicemistrz Polski FA" },
      { label: "Złoty drużyny w finale centralnym Mistrzostw Polski FA", badge: "mistrz Polski FA" }
    ]
  },
  {
    title: "FA CAMPS",
    items: [
      { label: "Zamówienie i zrealizowanie turnusu półkolonii", badge: "ośrodek organizujący półkolonie FA" },
      "Zamówienie i zrealizowanie campu weekendowego",
      { label: "Zamówienie i zrealizowanie obozu dedykowanego", badge: "ośrodek organizujący obóz FA" },
      "Udział w półkoloni - funkcja kierownika",
      "Udział w obozie - funkcja kierownika",
      "Udział w obozie dochodzeniowym - funkcja kierownika",
      "Udział w obozie Kadry Polski - funkcja kierownika",
      "Udział w obozie zagranicznym - funkcja kierownika",
      "Udział w wycieczce - funkcja kierownika"
    ]
  },
  {
    title: "FASE",
    items: [
      { label: "Udział w \"Dniach Próby\"", badge: "wychowanek w FASE" }
    ]
  },
  {
    title: "UDZIAŁ W WYDARZENIACH",
    items: [
      "Przesłanie wideo z treningu",
      "Udział w szkoleniu dla managerów FA",
      "Udział w Konwencie FA",
      { label: "Udział w Krewkim Piłkarzu", badge: "manager odpowiedzialny społecznie" },
      { label: "Udział w Szlachetnej Paczce", badge: "manager odpowiedzialny społecznie" },
      "Udział w webinarze FA"
    ]
  },
  {
    title: "NOMINACJE/NAGRODY",
    items: [
      "Nominacja na Konwencie FA",
      { label: "Nagroda na Konwencie FA", badge: "nagroda na Konwencie FA" },
      { label: "Nominacja na członka Rady Managerów", badge: "członek Rady Managerów FA" }
    ]
  },
  {
    title: "OTWARCIE FOOTBALL PARKU",
    items: [
      { label: "Otwarcie Football Parku", badge: "Otwarcie Football Park" }
    ]
  },
  {
    title: "FA SHOP",
    items: [
      "Każde wydane 10 zł przez managera"
    ]
  }
];
