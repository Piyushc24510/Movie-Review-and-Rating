// ====================== CONFIG & API SETUP ======================
const TMDB_OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkYmE4ODA0YjA4NjAxYjExOGExZjFhZjZhMzgzNGI3NCIsInN1YiI6IjY0OWVmZmM0YzlkYmY5MDEwN2UxZTU0MiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.EV_B46kJXwRaqfcfXunUdvSCCDyyRzkS13QBLwEgXK4'
  }
};

const STORAGE_KEY = 'remo_reviews_v1'; // single JSON object with all reviews
const THEME_KEY = 'remo_theme';

// local in-memory
let reviews = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

// ====================== THEME (Light / Dark) ======================
const themeToggleBtn = document.getElementById('themeToggle');

function applyTheme(theme) {
  if (theme === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  localStorage.setItem(THEME_KEY, theme);
  themeToggleBtn.textContent = theme === 'dark' ? '🌙 Dark' : '🌞 Light';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
  themeToggleBtn.addEventListener('click', () => {
    const current = document.body.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}
initTheme();

// ====================== SAVED REVIEWS MODAL ======================
const savedReviewsBtn = document.getElementById('savedReviewsBtn');
const savedReviewsModal = document.getElementById('savedReviewsModal');
const savedReviewsClose = document.getElementById('savedReviewsClose');

savedReviewsBtn.addEventListener('click', () => {
  loadSavedReviewsSection();
  savedReviewsModal.style.display = 'flex';
});

savedReviewsClose.addEventListener('click', () => {
  savedReviewsModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === savedReviewsModal) {
    savedReviewsModal.style.display = 'none';
  }
});

// ====================== UTILS ======================
function movieKey(id, title) {
  // Use TMDB id when available for uniqueness, fallback to safe title
  if (id !== undefined && id !== null) return `movie_${id}`;
  return 'movie_' + title.replace(/[^a-zA-Z0-9 ]/g, '_').slice(0, 60);
}

function saveAllReviewsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

function formatDateISOStringNow() {
  return new Date().toISOString();
}

// truncate helper
function truncate(text, n = 140) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n) + '…' : text;
}

// create star elements (returns container)
function createStarsElement(key, initialRating = 0) {
  const starsDiv = document.createElement('div');
  starsDiv.classList.add('stars');
  starsDiv.id = `stars-${key}`;

  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.classList.add('star');
    span.dataset.value = i;
    span.innerHTML = '&#9733;'; // star char
    if (i <= initialRating) span.classList.add('selected');
    span.addEventListener('click', () => {
      const value = parseInt(span.dataset.value);
      // highlight immediately
      highlightStars(key, value);
      // store temp rating in-memory reviews object so Save uses it
      if (!reviews[key]) reviews[key] = { title: '', rating: 0, review: '', poster: '', savedAt: null };
      reviews[key].ratingTemp = value;
      // reflect live saved preview (optional)
      updateSavedPreviewForKey(key);
    });
    starsDiv.appendChild(span);
  }
  return starsDiv;
}

function highlightStars(key, value) {
  const container = document.querySelector(`#stars-${CSS.escape(key)}`);
  if (!container) return;
  const spans = container.querySelectorAll('.star');
  spans.forEach(s => {
    const v = parseInt(s.dataset.value);
    s.classList.toggle('selected', v <= value);
  });
}

// ====================== RENDER & FETCH HELPERS ======================
const resultsDiv = document.querySelector('.results');

function renderMoviesFromData(data) {
  resultsDiv.innerHTML = '';
  if (!data || !data.results || data.results.length === 0) {
    resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">No movies found.</p>';
    return;
  }
  data.results.forEach(movie => {
    const movieDiv = document.createElement('div');
    movieDiv.classList.add('movie');

    const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '';
    const img = document.createElement('img');
    img.src = posterUrl || 'https://via.placeholder.com/220x330?text=No+Image';
    img.alt = movie.title;

    const title = document.createElement('h2');
    title.textContent = movie.title;

    const release = document.createElement('p');
    release.textContent = movie.release_date ? `Release: ${movie.release_date}` : '';

    // overview + show more
    const overview = document.createElement('p');
    overview.classList.add('overview');
    const fullOverview = movie.overview || '';
    overview.textContent = truncate(fullOverview, 140);

    const showMoreBtn = document.createElement('button');
    showMoreBtn.classList.add('show-more');
    showMoreBtn.textContent = fullOverview.length > 140 ? 'Show more' : '';
    if (fullOverview.length > 140) {
      showMoreBtn.addEventListener('click', () => {
        const expanded = showMoreBtn.dataset.expanded === 'true';
        if (!expanded) {
          overview.textContent = fullOverview;
          showMoreBtn.textContent = 'Show less';
          showMoreBtn.dataset.expanded = 'true';
        } else {
          overview.textContent = truncate(fullOverview, 140);
          showMoreBtn.textContent = 'Show more';
          showMoreBtn.dataset.expanded = 'false';
        }
      });
    }

    // review section
    const key = movieKey(movie.id, movie.title);
    const reviewSection = createReviewSectionForMovie({
      id: movie.id,
      key,
      title: movie.title,
      poster: posterUrl,
      release: movie.release_date,
      overview: fullOverview
    });

    movieDiv.appendChild(img);
    movieDiv.appendChild(title);
    movieDiv.appendChild(release);
    movieDiv.appendChild(overview);
    if (showMoreBtn.textContent) movieDiv.appendChild(showMoreBtn);
    movieDiv.appendChild(reviewSection);

    resultsDiv.appendChild(movieDiv);
  });
}

// initial discover/popular load (same as original but better display)
fetch('https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc', TMDB_OPTIONS)
  .then(r => r.json())
  .then(renderMoviesFromData)
  .catch(err => {
    console.error(err);
    resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Could not load movies. Check console.</p>';
  });

// ====================== SEARCH ======================s  

function fetchMovie() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Searching...</p>';
  fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`, TMDB_OPTIONS)
    .then(r => r.json())
    .then(renderMoviesFromData)
    .catch(err => {
      console.error(err);
      resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Search failed.</p>';
    });
}
document.getElementById('searchButton').addEventListener('click', fetchMovie);
document.getElementById('searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchMovie(); });

// ====================== CATEGORY BUTTONS ======================
document.getElementById("nowPlayingButton").addEventListener("click", () => fetchCategory('now_playing'));
document.getElementById("topRatedButton").addEventListener("click", () => fetchCategory('top_rated'));
document.getElementById("upcomingButton").addEventListener("click", () => fetchCategory('upcoming'));
document.getElementById("popularButton").addEventListener("click", () => fetchCategory('popular'));

const filterSelect = document.getElementById('filterSelect');

filterSelect.addEventListener('change', () => {
  const selected = filterSelect.value;
  if (selected === 'all') {
    fetchCategory('popular');
    return;
  }

  const genreMap = {
    action: 28,
    adventure: 12,
    animation: 16,
    comedy: 35,
    crime: 80,
    documentary: 99,
    drama: 18,
    family: 10751,
    fantasy: 14,
    history: 36,
    horror: 27,
    music: 10402,
    mystery: 9648,
    romance: 10749,
    'science-fiction': 878,
    'tv-movie': 10770,
    thriller: 53,
    war: 10752,
    western: 37
  };

  const genreId = genreMap[selected];
  resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Filtering...</p>';

  fetch(`https://api.themoviedb.org/3/discover/movie?with_genres=${genreId}&language=en-US&page=1`, TMDB_OPTIONS)
    .then(r => r.json())
    .then(renderMoviesFromData)
    .catch(err => {
      console.error(err);
      resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Filter failed.</p>';
    });
});


function fetchCategory(cat) {
  resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Loading...</p>';
  fetch(`https://api.themoviedb.org/3/movie/${cat}?language=en-US&page=1`, TMDB_OPTIONS)
    .then(r => r.json())
    .then(renderMoviesFromData)
    .catch(err => {
      console.error(err);
      resultsDiv.innerHTML = '<p style="padding:20px;text-align:center;">Could not load category.</p>';
    });
}

// ====================== REVIEW SECTION (create/save/show) ======================
function createReviewSectionForMovie({ id, key, title, poster, release, overview }) {
  // ensure reviews object has an entry shape
  if (!reviews[key]) {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')[key];
    reviews[key] = stored || { title, rating: 0, review: '', poster, release, savedAt: null };
  } else {
    // keep info updated
    reviews[key].title = reviews[key].title || title;
    reviews[key].poster = reviews[key].poster || poster;
    reviews[key].release = reviews[key].release || release;
  }

  const container = document.createElement('div');
  container.classList.add('review-section');

  // header
  const h3 = document.createElement('h3');
  h3.textContent = 'Rate & Review';
  container.appendChild(h3);

  // stars
  const initialRating = reviews[key].rating || 0;
  const starsEl = createStarsElement(key, initialRating);
  container.appendChild(starsEl);

  // textarea
  const textarea = document.createElement('textarea');
  textarea.id = `review-${key}`;
  textarea.placeholder = 'Write your review...';
  textarea.value = reviews[key].review || '';
  textarea.style.fontFamily = '"Times New Roman", Times, serif';
  container.appendChild(textarea);

  // buttons: save + delete
  const btnSave = document.createElement('button');
  btnSave.textContent = 'Save Review';
  btnSave.style.marginRight = '6px';
  btnSave.addEventListener('click', () => {
    const tempRating = reviews[key].ratingTemp || 0;
    const reviewText = textarea.value.trim();
    reviews[key].rating = tempRating;
    reviews[key].review = reviewText;
    reviews[key].title = title;
    reviews[key].poster = poster;
    reviews[key].release = release;
    reviews[key].savedAt = formatDateISOStringNow();

    // cleanup temp
    delete reviews[key].ratingTemp;
    saveAllReviewsToStorage();
    updateSavedPreviewForKey(key);
  });
  container.appendChild(btnSave);

  const btnDelete = document.createElement('button');
  btnDelete.textContent = 'Delete';
  btnDelete.addEventListener('click', () => {
    if (confirm(`Delete saved review for "${title}"?`)) {
      delete reviews[key];
      saveAllReviewsToStorage();
      updateSavedPreviewForKey(key);
      // also clear UI stars & textarea
      highlightStars(key, 0);
      textarea.value = '';
    }
  });
  container.appendChild(btnDelete);

  // saved preview
  const savedDiv = document.createElement('div');
  savedDiv.classList.add('saved-review');
  savedDiv.id = `saved-${key}`;
  container.appendChild(savedDiv);

  // initialize preview
  updateSavedPreviewForKey(key);

  return container;
}

function updateSavedPreviewForKey(key) {
  const savedDiv = document.getElementById(`saved-${key}`);
  if (!savedDiv) return;
  const data = reviews[key];
  if (data && (data.review || data.rating)) {
    savedDiv.innerHTML = `<p><strong>Saved!</strong> Rating: ${data.rating}/5<br>${escapeHtml(data.review || '')}</p>`;
    highlightStars(key, data.rating || 0);
  } else {
    savedDiv.innerHTML = '';
    highlightStars(key, 0);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ====================== MY SAVED REVIEWS SECTION (MODAL) ======================
const savedContainer = document.getElementById('savedMoviesContainer');

function loadSavedReviewsSection() {
  // refresh from storage (in case something external changed)
  reviews = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  savedContainer.innerHTML = '';
  const keys = Object.keys(reviews);
  
  if (keys.length === 0) {
    // The empty state is handled by CSS ::before pseudo-element
    return;
  }

  // sort by savedAt desc
  keys.sort((a, b) => {
    const ra = reviews[a] && reviews[a].savedAt ? new Date(reviews[a].savedAt).getTime() : 0;
    const rb = reviews[b] && reviews[b].savedAt ? new Date(reviews[b].savedAt).getTime() : 0;
    return rb - ra;
  });

  keys.forEach(key => {
    const data = reviews[key];
    if (!data) return;
    const card = document.createElement('div');
    card.classList.add('movie');

    const img = document.createElement('img');
    img.src = data.poster || 'https://via.placeholder.com/100x150?text=No+Image';
    img.style.width = '80px';
    img.style.height = '120px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';

    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = data.title || 'Untitled';
    title.style.margin = '0 0 6px 0';
    
    const meta = document.createElement('small');
    meta.textContent = data.savedAt ? `Saved: ${new Date(data.savedAt).toLocaleString()}` : '';
    meta.style.display = 'block';
    meta.style.marginBottom = '6px';

    // show stars preview
    const starsWrap = document.createElement('div');
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.classList.add('star');
      s.innerHTML = '&#9733;';
      if (data.rating && i <= data.rating) s.classList.add('selected');
      starsWrap.appendChild(s);
    }

    const reviewText = document.createElement('p');
    reviewText.textContent = data.review || '';
    reviewText.style.margin = '6px 0';

    // buttons: View (opens modal) & Delete
    const btnView = document.createElement('button');
    btnView.textContent = 'View';
    btnView.style.marginRight = '8px';
    btnView.addEventListener('click', () => {
      openModal(`<h2>${escapeHtml(data.title)}</h2>
                 <p>${escapeHtml(data.review)}</p>
                 <p>Rating: ${data.rating}/5</p>`);
    });

    const btnDel = document.createElement('button');
    btnDel.textContent = 'Delete';
    btnDel.addEventListener('click', () => {
      if (confirm(`Delete "${data.title}" from saved reviews?`)) {
        delete reviews[key];
        saveAllReviewsToStorage();
        loadSavedReviewsSection();
        // also update any open movie cards
        updateSavedPreviewForKey(key);
      }
    });

    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(starsWrap);
    content.appendChild(reviewText);
    content.appendChild(btnView);
    content.appendChild(btnDel);

    card.appendChild(img);
    card.appendChild(content);
    savedContainer.appendChild(card);
  });
}

// ====================== MODAL (About / Contact / Terms / License) ======================
const infoModal = document.getElementById('infoModal');
const modalText = document.getElementById('modalText');
const modalClose = document.querySelector('.modal .close');

function openModal(html) {
  modalText.innerHTML = html;
  infoModal.style.display = 'flex';
}

if (modalClose) modalClose.addEventListener('click', () => infoModal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.style.display = 'none'; });

// nav link handlers
document.getElementById('aboutLink').addEventListener('click', (e) => {
  e.preventDefault();
  openModal(`<h2>About RemoFlix</h2>
            <p>RemoFlix is a mini movie reviews app built as part of the Remotronics project. 
            Save ratings & reviews locally and manage them via the "Saved Reviews" button.
            <br><br>Data is fetched from The Movie Database (TMDB) API.
            <br><br>Created by Piyush Chawla - <a href="https://github.com/Piyushc24510" target="_blank">GitHub</a>            
            </p>`);
});
document.getElementById('contactLink').addEventListener('click', (e) => {
  e.preventDefault();
  openModal(`<h2>Contact</h2>
            <p><center>Email: sarcasticholyshit@gmail.com</center></p>
            <p>GitHub: <a href="https://github.com/Piyushc24510" target="_blank">Piyushc24510</a></p>`);
});
document.getElementById('termsLink').addEventListener('click', (e) => {
  e.preventDefault();
  openModal(`<h2>Terms</h2><p>This demo stores reviews locally in your browser's localStorage. No data is sent to any server by this demo.</p>`);
});
document.getElementById('licenseLink').addEventListener('click', (e) => {
  e.preventDefault();
  openModal(`<h2>License</h2><p>Use this project for learning and minor project purposes. 
    Please credit RemoFlix if reused.
    <br><br>TMDB API and data are property of The Movie Database (TMDB).
    <br><br>Star icons are from FontAwesome (CC BY 4.0).
    <br><br>All other code and assets are by Piyush Chawla (MIT License).
    <br><br>For more information, visit the project's <a href="https://github.com/Piyushc24510/remotronics" target="_blank">GitHub repository</a>.
    </p>`);
});

// ====================== EXTRA: keep UI in sync when storage changes elsewhere (if any) ======================
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    loadSavedReviewsSection();
  }
});
