# Wdrożenie na GitHub Pages

## 🌐 Adres strony

Po wdrożeniu, aplikacja będzie dostępna pod adresem:
**https://finestedm.github.io/ProCalc/**

## 📋 Kroki konfiguracji

### 1. Włączenie GitHub Pages

1. Przejdź do repozytorium: https://github.com/finestedm/ProCalc
2. Kliknij **Settings** (Ustawienia)
3. W menu bocznym wybierz **Pages**
4. W sekcji **Source** wybierz: **GitHub Actions**

![GitHub Pages Settings](https://docs.github.com/assets/cb-47267/mw-1440/images/help/pages/create-page-choose-source.webp)

### 2. Konfiguracja zmiennych środowiskowych (Secrets)

Aplikacja wymaga następujących zmiennych środowiskowych:

#### Jak dodać Secrets:

1. W repozytorium przejdź do **Settings** → **Secrets and variables** → **Actions**
2. Kliknij **New repository secret**
3. Dodaj następujące secrets:

| Nazwa | Opis | Gdzie znaleźć |
|-------|------|---------------|
| `GEMINI_API_KEY` | Klucz API Google Gemini | https://aistudio.google.com/app/apikey |
| `VITE_SUPABASE_URL` | URL projektu Supabase | Dashboard Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Klucz publiczny Supabase | Dashboard Supabase → Project Settings → API |

#### Krok po kroku - dodawanie Secret:

1. Kliknij **New repository secret**
2. W polu **Name** wpisz nazwę (np. `GEMINI_API_KEY`)
3. W polu **Secret** wklej wartość klucza
4. Kliknij **Add secret**
5. Powtórz dla pozostałych zmiennych

![Add Secret](https://docs.github.com/assets/cb-48866/mw-1440/images/help/settings/actions-secrets-new.webp)

### 3. Wdrożenie aplikacji

#### Automatyczne wdrożenie:

Po skonfigurowaniu GitHub Pages i Secrets, wystarczy:

```bash
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

Workflow automatycznie:
- Zainstaluje zależności
- Zbuduje aplikację z Twoimi zmiennymi środowiskowymi
- Wdroży na GitHub Pages

#### Sprawdzanie statusu:

1. Przejdź do zakładki **Actions** w repozytorium
2. Zobaczysz workflow "Deploy to GitHub Pages"
3. Kliknij na niego, aby zobaczyć szczegóły i logi

### 4. Ręczne uruchomienie deployment

Możesz też uruchomić deployment ręcznie:

1. Przejdź do **Actions**
2. Wybierz workflow "Deploy to GitHub Pages"
3. Kliknij **Run workflow**
4. Wybierz branch `main`
5. Kliknij **Run workflow**

## 🔧 Lokalne testowanie buildu

Przed wdrożeniem możesz przetestować build lokalnie:

```bash
# Zbuduj aplikację
npm run build

# Podejrzyj build lokalnie
npm run preview
```

Aplikacja będzie dostępna pod adresem wyświetlonym w terminalu (zazwyczaj http://localhost:4173)

## 🔄 Aktualizacje

Każdy push do brancha `main` automatycznie uruchomi nowy deployment.

## ⚠️ Ważne uwagi

- **Zmienne środowiskowe**: Upewnij się, że wszystkie Secrets są poprawnie skonfigurowane
- **Supabase**: Sprawdź czy Twój projekt Supabase akceptuje requesty z domeny `finestedm.github.io`
- **CORS**: Jeśli używasz zewnętrznych API, upewnij się że mają skonfigurowany CORS dla GitHub Pages

## 🐛 Rozwiązywanie problemów

### Strona nie ładuje się poprawnie

- Sprawdź czy w `vite.config.ts` jest ustawione `base: '/ProCalc/'`
- Sprawdź logi w zakładce Actions

### Błędy związane ze zmiennymi środowiskowymi

- Upewnij się, że wszystkie Secrets są dodane w Settings → Secrets and variables → Actions
- Nazwy muszą dokładnie odpowiadać tym w workflow

### Workflow się nie uruchamia

- Sprawdź czy GitHub Pages jest włączone i ustawione na "GitHub Actions"
- Sprawdź czy plik `.github/workflows/deploy.yml` został poprawnie zacommitowany
