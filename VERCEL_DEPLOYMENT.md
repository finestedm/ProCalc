# Wdrożenie na Vercel

## 🚀 Dlaczego Vercel?

- ✅ **Prostsze** niż GitHub Pages
- ✅ **Automatyczne** wdrożenia przy każdym push
- ✅ **Łatwa konfiguracja** zmiennych środowiskowych
- ✅ **Darmowy** dla projektów osobistych
- ✅ **Stworzony dla Vite/React** - zero konfiguracji

---

## 📋 Kroki wdrożenia

### Metoda 1: Przez stronę Vercel (Najłatwiejsza) ⭐

#### 1. Utwórz konto Vercel

1. Przejdź do: https://vercel.com/signup
2. Zaloguj się przez GitHub
3. Autoryzuj Vercel do dostępu do repozytoriów

#### 2. Importuj projekt

1. Kliknij **"Add New..."** → **"Project"**
2. Znajdź i wybierz repozytorium `finestedm/ProCalc`
3. Kliknij **"Import"**

#### 3. Skonfiguruj projekt

Vercel automatycznie wykryje że to projekt Vite. Upewnij się że:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### 4. Dodaj zmienne środowiskowe

W sekcji **"Environment Variables"** dodaj:

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | Twój klucz API Google Gemini |
| `VITE_SUPABASE_URL` | `https://vdjafpedybvbjmntgrsg.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Twój klucz Supabase |

> [!IMPORTANT]
> Zmienne środowiskowe w Vercel są dostępne zarówno podczas buildu jak i w runtime.

#### 5. Deploy!

1. Kliknij **"Deploy"**
2. Poczekaj ~2 minuty na build
3. Gotowe! 🎉

Twoja aplikacja będzie dostępna pod adresem typu:
**https://pro-calc-xyz.vercel.app**

---

### Metoda 2: Przez CLI (Dla zaawansowanych)

#### 1. Zainstaluj Vercel CLI

```bash
npm install -g vercel
```

#### 2. Zaloguj się

```bash
vercel login
```

#### 3. Deploy

```bash
cd /home/pawe/Aplikacje/ProCalc
vercel
```

Postępuj zgodnie z instrukcjami w terminalu.

---

## ⚙️ Konfiguracja

### Plik vercel.json

Utworzono plik [vercel.json](file:///home/pawe/Aplikacje/ProCalc/vercel.json) z konfiguracją:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

### Aktualizacja vite.config.ts

Usunięto `base: '/ProCalc/'` z konfiguracji Vite, ponieważ Vercel serwuje aplikację z głównej domeny.

---

## 🔄 Automatyczne wdrożenia

Po pierwszym wdrożeniu, każdy push do brancha `main` automatycznie:

1. Uruchomi nowy build
2. Wdroży nową wersję
3. Wyśle powiadomienie o statusie

Możesz to skonfigurować w **Settings** → **Git** w panelu Vercel.

---

## 🌐 Własna domena (Opcjonalnie)

Jeśli chcesz użyć własnej domeny:

1. W panelu Vercel przejdź do **Settings** → **Domains**
2. Dodaj swoją domenę
3. Skonfiguruj DNS zgodnie z instrukcjami

---

## 📊 Monitoring i Analytics

Vercel oferuje:

- **Analytics** - statystyki odwiedzin
- **Logs** - logi z buildu i runtime
- **Performance** - metryki wydajności

Wszystko dostępne w panelu projektu.

---

## 🔧 Rozwiązywanie problemów

### Build się nie udaje

1. Sprawdź logi w zakładce **Deployments**
2. Upewnij się że wszystkie zmienne środowiskowe są ustawione
3. Sprawdź czy lokalnie `npm run build` działa

### Zmienne środowiskowe nie działają

1. Upewnij się że zmienne zaczynają się od `VITE_` (dla Vite)
2. Po dodaniu zmiennych, wykonaj **Redeploy**

### Aplikacja nie ładuje się

1. Sprawdź czy `dist` folder jest poprawnie generowany
2. Sprawdź Console w przeglądarce pod kątem błędów

---

## 📝 Następne kroki

1. **Commit zmiany**:
   ```bash
   git add vercel.json vite.config.ts
   git commit -m "Configure Vercel deployment"
   git push origin main
   ```

2. **Przejdź do Vercel**: https://vercel.com/new

3. **Importuj projekt** i dodaj zmienne środowiskowe

4. **Deploy!**

---

## 🎯 Porównanie: Vercel vs GitHub Pages

| Feature | Vercel | GitHub Pages |
|---------|--------|--------------|
| Setup | ⭐⭐⭐⭐⭐ Bardzo łatwy | ⭐⭐⭐ Średni |
| Env Variables | ✅ Wbudowane | ❌ Wymaga Secrets + workflow |
| Auto Deploy | ✅ Tak | ✅ Tak (z workflow) |
| Custom Domain | ✅ Darmowa | ✅ Darmowa |
| Analytics | ✅ Wbudowane | ❌ Brak |
| Preview Deploys | ✅ Dla PR | ❌ Brak |
| Build Time | ⚡ ~2 min | ⚡ ~2-3 min |

**Rekomendacja**: Vercel dla projektów z zmiennymi środowiskowymi i częstymi deploymentami.
