const recipeForm = document.querySelector("#recipe-form");
const recipeNameInput = document.querySelector("#recipe-name");
const recipeIngredientsInput = document.querySelector("#recipe-ingredients");
const recipeList = document.querySelector("#recipe-list");
const recipeCount = document.querySelector("#recipe-count");
const weekMenu = document.querySelector("#week-menu");
const groceryList = document.querySelector("#grocery-list");
const groceryCount = document.querySelector("#grocery-count");
const makeMenuButton = document.querySelector("#make-menu-button");
const storageStatus = document.querySelector("#storage-status");

const storageKey = "week-menu-maker-recipes";
const menuStorageKey = "week-menu-maker-current-menu";
const groceryStorageKey = "week-menu-maker-grocery-items";
const weekMenuStateKey = "default-week-menu";
const supabaseConfig = window.WEEK_MENU_SUPABASE_CONFIG ?? {};
const supabaseUrl = supabaseConfig.supabaseUrl ?? "";
const supabaseAnonKey = supabaseConfig.supabaseAnonKey ?? "";
const isSupabaseConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("PASTE_YOUR_SUPABASE_URL_HERE") &&
  !supabaseAnonKey.includes("PASTE_YOUR_SUPABASE_ANON_KEY_HERE");

const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const menuDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
];

const starterRecipes = [
  {
    id: crypto.randomUUID(),
    name: "Lemon Chicken Tray Bake",
    ingredients: ["Chicken", "Potatoes", "Lemon", "Garlic", "Rosemary"],
  },
  {
    id: crypto.randomUUID(),
    name: "Veggie Stir-Fry",
    ingredients: ["Noodles", "Bell pepper", "Broccoli", "Soy sauce", "Ginger"],
  },
  {
    id: crypto.randomUUID(),
    name: "Creamy Tomato Pasta",
    ingredients: ["Pasta", "Tomatoes", "Cream", "Parmesan", "Basil"],
  },
];

let recipes = [];
let currentMenuRecipeIds = [];
let groceryItems = [];
let usesSupabaseForWeekMenu = Boolean(supabaseClient);
let usesSupabaseForGroceries = Boolean(supabaseClient);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStorageStatus(message, tone = "info") {
  storageStatus.textContent = message;
  storageStatus.dataset.tone = tone;
}

function updateSyncStatus() {
  if (!supabaseClient) {
    setStorageStatus(
      "Using browser storage. Add your Supabase keys to sync recipes and groceries across devices.",
      "warning"
    );
    return;
  }

  if (usesSupabaseForWeekMenu && usesSupabaseForGroceries) {
    setStorageStatus(
      "Recipes, menu, and grocery checklist are saving to Supabase and will sync across devices.",
      "success"
    );
    return;
  }

  setStorageStatus(
    "Recipes sync to Supabase, but the grocery checklist is using this browser until the extra Supabase tables are added.",
    "warning"
  );
}

function loadRecipesFromLocalStorage() {
  const savedRecipes = localStorage.getItem(storageKey);

  if (!savedRecipes) {
    return starterRecipes;
  }

  try {
    const parsedRecipes = JSON.parse(savedRecipes);

    if (!Array.isArray(parsedRecipes)) {
      return starterRecipes;
    }

    return parsedRecipes.filter(isValidRecipeShape);
  } catch {
    return starterRecipes;
  }
}

function saveRecipesToLocalStorage() {
  localStorage.setItem(storageKey, JSON.stringify(recipes));
}

function loadWeekMenuFromLocalStorage() {
  const savedWeekMenu = localStorage.getItem(menuStorageKey);

  if (!savedWeekMenu) {
    return [];
  }

  try {
    const parsedMenu = JSON.parse(savedWeekMenu);
    return Array.isArray(parsedMenu) ? parsedMenu.map(String) : [];
  } catch {
    return [];
  }
}

function saveWeekMenuToLocalStorage() {
  localStorage.setItem(menuStorageKey, JSON.stringify(currentMenuRecipeIds));
}

function loadGroceriesFromLocalStorage() {
  const savedGroceries = localStorage.getItem(groceryStorageKey);

  if (!savedGroceries) {
    return [];
  }

  try {
    const parsedGroceries = JSON.parse(savedGroceries);

    if (!Array.isArray(parsedGroceries)) {
      return [];
    }

    return parsedGroceries.filter(isValidGroceryItemShape);
  } catch {
    return [];
  }
}

function saveGroceriesToLocalStorage() {
  localStorage.setItem(groceryStorageKey, JSON.stringify(groceryItems));
}

function isValidRecipeShape(recipe) {
  return (
    recipe &&
    (typeof recipe.id === "string" || typeof recipe.id === "number") &&
    typeof recipe.name === "string" &&
    Array.isArray(recipe.ingredients)
  );
}

function normalizeRecipe(record) {
  return {
    id: record.id,
    name: record.name,
    ingredients: Array.isArray(record.ingredients) ? record.ingredients : [],
  };
}

function isValidGroceryItemShape(item) {
  return (
    item &&
    typeof item.key === "string" &&
    typeof item.name === "string" &&
    Number.isInteger(item.count) &&
    typeof item.checked === "boolean"
  );
}

function normalizeGroceryItem(record) {
  return {
    key: String(record.item_key ?? record.key),
    name: String(record.ingredient_name ?? record.name),
    count: Number(record.item_count ?? record.count ?? 1),
    checked: Boolean(record.checked),
  };
}

async function loadRecipes() {
  if (!supabaseClient) {
    recipes = loadRecipesFromLocalStorage();
    return;
  }

  const { data, error } = await supabaseClient
    .from("recipes")
    .select("id, name, ingredients")
    .order("created_at", { ascending: false });

  if (error) {
    recipes = loadRecipesFromLocalStorage();
    usesSupabaseForWeekMenu = false;
    usesSupabaseForGroceries = false;
    setStorageStatus("Could not connect to Supabase, so the app switched to browser storage.", "error");
    console.error(error);
    return;
  }

  recipes = data.map(normalizeRecipe);
}

async function loadWeekMenuState() {
  if (!supabaseClient || !usesSupabaseForWeekMenu) {
    currentMenuRecipeIds = loadWeekMenuFromLocalStorage();
    usesSupabaseForWeekMenu = false;
    return;
  }

  const { data, error } = await supabaseClient
    .from("week_menu_state")
    .select("recipe_ids")
    .eq("singleton_key", weekMenuStateKey)
    .maybeSingle();

  if (error) {
    currentMenuRecipeIds = loadWeekMenuFromLocalStorage();
    usesSupabaseForWeekMenu = false;
    console.error(error);
    return;
  }

  currentMenuRecipeIds = Array.isArray(data?.recipe_ids) ? data.recipe_ids.map(String) : [];
}

async function saveWeekMenuState() {
  if (!supabaseClient || !usesSupabaseForWeekMenu) {
    saveWeekMenuToLocalStorage();
    return;
  }

  const { error } = await supabaseClient.from("week_menu_state").upsert(
    {
      singleton_key: weekMenuStateKey,
      recipe_ids: currentMenuRecipeIds.map(String),
    },
    {
      onConflict: "singleton_key",
    }
  );

  if (error) {
    usesSupabaseForWeekMenu = false;
    saveWeekMenuToLocalStorage();
    console.error(error);
  }
}

async function loadGroceryItems() {
  if (!supabaseClient || !usesSupabaseForGroceries) {
    groceryItems = loadGroceriesFromLocalStorage();
    usesSupabaseForGroceries = false;
    return;
  }

  const { data, error } = await supabaseClient
    .from("grocery_checklist_items")
    .select("item_key, ingredient_name, item_count, checked")
    .order("ingredient_name", { ascending: true });

  if (error) {
    groceryItems = loadGroceriesFromLocalStorage();
    usesSupabaseForGroceries = false;
    console.error(error);
    return;
  }

  groceryItems = data.map(normalizeGroceryItem);
}

async function saveGroceryItems() {
  if (!supabaseClient || !usesSupabaseForGroceries) {
    saveGroceriesToLocalStorage();
    return;
  }

  const { error: deleteError } = await supabaseClient
    .from("grocery_checklist_items")
    .delete()
    .neq("item_key", "");

  if (deleteError) {
    usesSupabaseForGroceries = false;
    saveGroceriesToLocalStorage();
    console.error(deleteError);
    return;
  }

  if (groceryItems.length === 0) {
    return;
  }

  const payload = groceryItems.map((item) => ({
    item_key: item.key,
    ingredient_name: item.name,
    item_count: item.count,
    checked: item.checked,
    label: formatGroceryLabel(item),
  }));

  const { error: insertError } = await supabaseClient
    .from("grocery_checklist_items")
    .insert(payload);

  if (insertError) {
    usesSupabaseForGroceries = false;
    saveGroceriesToLocalStorage();
    console.error(insertError);
  }
}

function parseIngredients(rawIngredients) {
  return rawIngredients
    .split(/\n|,/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

function shuffleRecipes(recipeArray) {
  const shuffled = [...recipeArray];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function normalizeIngredientName(ingredient) {
  return ingredient.replace(/\s+/g, " ").trim();
}

function buildIngredientKey(ingredient) {
  return normalizeIngredientName(ingredient).toLowerCase();
}

function formatGroceryLabel(item) {
  return item.count > 1 ? `${item.name} x ${item.count}` : item.name;
}

function updateRecipeCount() {
  recipeCount.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`;
}

function updateGroceryCount() {
  groceryCount.textContent = `${groceryItems.length} item${groceryItems.length === 1 ? "" : "s"}`;
}

function renderRecipes() {
  if (recipes.length === 0) {
    recipeList.innerHTML =
      '<p class="empty-state">No recipes yet. Add your first one above.</p>';
    updateRecipeCount();
    return;
  }

  recipeList.innerHTML = recipes
    .map(
      (recipe) => `
        <article class="recipe-card">
          <div class="recipe-card-header">
            <div>
              <h4>${escapeHtml(recipe.name)}</h4>
            </div>
            <button
              class="ghost-button"
              type="button"
              data-remove-id="${escapeHtml(String(recipe.id))}"
            >
              Remove
            </button>
          </div>
          <ul class="ingredient-list">
            ${recipe.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");

  updateRecipeCount();
}

function renderWeekMenu(menuRecipes) {
  weekMenu.innerHTML = menuRecipes
    .map(
      (recipe, index) => `
        <article class="day-card">
          <div class="day-card-header">
            <div>
              <div class="day-label">${menuDays[index]}</div>
              <h4>${escapeHtml(recipe.name)}</h4>
            </div>
          </div>
          <p>${recipe.ingredients.map(escapeHtml).join(", ")}</p>
        </article>
      `
    )
    .join("");
}

function renderGroceryList() {
  if (groceryItems.length === 0) {
    groceryList.innerHTML =
      '<p class="empty-state">Your grocery list will appear here after the 3 day menu is generated.</p>';
    updateGroceryCount();
    return;
  }

  groceryList.innerHTML = groceryItems
    .map(
      (item) => `
        <label class="grocery-item${item.checked ? " is-checked" : ""}">
          <input
            class="grocery-checkbox"
            type="checkbox"
            data-grocery-key="${escapeHtml(item.key)}"
            ${item.checked ? "checked" : ""}
          />
          <span class="grocery-item-text">${escapeHtml(formatGroceryLabel(item))}</span>
        </label>
      `
    )
    .join("");

  updateGroceryCount();
}

function buildGroceryItemsFromMenu(menuRecipes, existingItems = []) {
  const counts = new Map();
  const checkedByKey = new Map(existingItems.map((item) => [item.key, item.checked]));

  for (const recipe of menuRecipes) {
    for (const ingredient of recipe.ingredients) {
      const normalizedName = normalizeIngredientName(ingredient);

      if (!normalizedName) {
        continue;
      }

      const key = buildIngredientKey(normalizedName);
      const existingEntry = counts.get(key);

      if (existingEntry) {
        existingEntry.count += 1;
        continue;
      }

      counts.set(key, {
        key,
        name: normalizedName,
        count: 1,
        checked: checkedByKey.get(key) ?? false,
      });
    }
  }

  return [...counts.values()].sort((firstItem, secondItem) =>
    firstItem.name.localeCompare(secondItem.name)
  );
}

function getMenuRecipesFromIds(menuRecipeIds) {
  return menuRecipeIds
    .map((recipeId) => recipes.find((recipe) => String(recipe.id) === String(recipeId)))
    .filter(Boolean);
}

async function syncMenuAndGroceries(menuRecipes) {
  currentMenuRecipeIds = menuRecipes.map((recipe) => String(recipe.id));
  groceryItems = buildGroceryItemsFromMenu(menuRecipes, groceryItems);
  renderWeekMenu(menuRecipes);
  renderGroceryList();
  await saveWeekMenuState();
  await saveGroceryItems();
  updateSyncStatus();
}

async function buildWeekMenu() {
  if (recipes.length === 0) {
    weekMenu.innerHTML =
      '<p class="empty-state">Please add at least one recipe before making a 3 day menu.</p>';
    currentMenuRecipeIds = [];
    groceryItems = [];
    renderGroceryList();
    await saveWeekMenuState();
    await saveGroceryItems();
    return;
  }

  const shuffledRecipes = shuffleRecipes(recipes);
  const menuRecipes = menuDays.map((_, index) => {
    return shuffledRecipes[index % shuffledRecipes.length];
  });

  await syncMenuAndGroceries(menuRecipes);
}

async function renderSavedMenuOrBuildOne() {
  const storedMenuRecipes = getMenuRecipesFromIds(currentMenuRecipeIds);

  if (storedMenuRecipes.length === currentMenuRecipeIds.length && storedMenuRecipes.length > 0) {
    groceryItems = buildGroceryItemsFromMenu(storedMenuRecipes, groceryItems);
    renderWeekMenu(storedMenuRecipes);
    renderGroceryList();
    updateSyncStatus();
    return;
  }

  await buildWeekMenu();
}

async function toggleGroceryItem(itemKey, checked) {
  groceryItems = groceryItems.map((item) =>
    item.key === itemKey ? { ...item, checked } : item
  );
  renderGroceryList();
  await saveGroceryItems();
  updateSyncStatus();
}

async function addRecipe(recipe) {
  if (!supabaseClient) {
    recipes = [recipe, ...recipes];
    saveRecipesToLocalStorage();
    return;
  }

  const { data, error } = await supabaseClient
    .from("recipes")
    .insert({
      name: recipe.name,
      ingredients: recipe.ingredients,
    })
    .select("id, name, ingredients")
    .single();

  if (error) {
    setStorageStatus(
      "Supabase save failed. Check your table setup in the README steps below.",
      "error"
    );
    throw error;
  }

  recipes = [normalizeRecipe(data), ...recipes];
}

async function removeRecipe(recipeId) {
  if (!supabaseClient) {
    recipes = recipes.filter((recipe) => String(recipe.id) !== String(recipeId));
    saveRecipesToLocalStorage();
    return;
  }

  const { error } = await supabaseClient.from("recipes").delete().eq("id", recipeId);

  if (error) {
    setStorageStatus("Supabase delete failed. Please try again.", "error");
    throw error;
  }

  recipes = recipes.filter((recipe) => String(recipe.id) !== String(recipeId));
}

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = recipeNameInput.value.trim();
  const ingredients = parseIngredients(recipeIngredientsInput.value);

  if (!name || ingredients.length === 0) {
    return;
  }

  const draftRecipe = {
    id: crypto.randomUUID(),
    name,
    ingredients,
  };

  try {
    await addRecipe(draftRecipe);
    renderRecipes();
    await buildWeekMenu();
    recipeForm.reset();
    recipeNameInput.focus();
  } catch (error) {
    console.error(error);
  }
});

recipeList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-id]");

  if (!button) {
    return;
  }

  try {
    await removeRecipe(button.dataset.removeId);
    renderRecipes();
    await buildWeekMenu();
  } catch (error) {
    console.error(error);
  }
});

groceryList.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-grocery-key]");

  if (!checkbox) {
    return;
  }

  try {
    await toggleGroceryItem(checkbox.dataset.groceryKey, checkbox.checked);
  } catch (error) {
    console.error(error);
  }
});

makeMenuButton.addEventListener("click", async () => {
  try {
    await buildWeekMenu();
  } catch (error) {
    console.error(error);
  }
});

async function initializeApp() {
  await loadRecipes();
  await loadWeekMenuState();
  await loadGroceryItems();
  renderRecipes();
  renderGroceryList();
  await renderSavedMenuOrBuildOne();
}

initializeApp();
