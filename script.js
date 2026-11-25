const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DIAS_PREVISAO = 10;
const CIDADES = ["Florianópolis","São Paulo","Rio de Janeiro","Brasília","Salvador","Porto Alegre"];

// Códigos WMO do Open-Meteo -> descrição e ícone
function condicao(c) {
  if (c === 0) return ["Céu limpo","☀️"];
  if (c === 1) return ["Predominantemente limpo","🌤️"];
  if (c === 2) return ["Parcialmente nublado","⛅"];
  if (c === 3) return ["Nublado","☁️"];
  if (c === 45 || c === 48) return ["Neblina","🌫️"];
  if ([51,53].includes(c)) return ["Garoa moderada","🌦️"];
  if (c === 55) return ["Garoa intensa","🌦️"];
  if ([56,57].includes(c)) return ["Garoa congelante","🌧️"];
  if ([61,80].includes(c)) return ["Chuva fraca","🌧️"];
  if ([63,81].includes(c)) return ["Chuva moderada","🌧️"];
  if ([65,82].includes(c)) return ["Chuva forte","🌧️"];
  if ([66,67].includes(c)) return ["Chuva congelante","🌧️"];
  if ([71,73,75,77,85,86].includes(c)) return ["Neve","❄️"];
  if (c >= 95) return ["Tempestade","⛈️"];
  return ["Indefinido","❔"];
}

const $ = id => document.getElementById(id);
const hora = iso => iso.slice(11,16);

function mostrarErro(msg) { $("erro").textContent = msg; $("erro").style.display = "block"; }
function limparErro() { $("erro").style.display = "none"; }

// Etapa 1: geocodificação
async function geocodificar(nome) {
  const url = `${GEO_URL}?name=${encodeURIComponent(nome)}&count=1&language=pt&format=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Falha ao consultar a geocodificação.");
  const dados = await resp.json();
  if (!dados.results || dados.results.length === 0) {
    throw new Error(`Localidade "${nome}" não encontrada. Verifique o nome e tente novamente.`);
  }
  return dados.results[0];
}

// Etapa 2: previsão
async function buscarPrevisao(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    forecast_days: DIAS_PREVISAO,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset"
  });
  const resp = await fetch(`${FORECAST_URL}?${params}`);
  if (!resp.ok) throw new Error("Falha ao consultar a previsão do tempo.");
  return resp.json();
}

function nomeDia(iso, i) {
  if (i === 0) return "Hoje";
  if (i === 1) return "Amanhã";
  const d = new Date(iso + "T12:00:00");
  const n = d.toLocaleDateString("pt-BR",{weekday:"long"});
  return n.charAt(0).toUpperCase() + n.slice(1).replace("-feira","");
}

function renderizar(local, p) {
  const c = p.current, d = p.daily;
  const [desc, ico] = condicao(c.weather_code);
  const regiao = [local.admin1, local.country].filter(Boolean).join(" — ");
  const atualizado = hora(c.time);

  const dias = d.time.map((dt, i) => {
    const [dsc, ic] = condicao(d.weather_code[i]);
    const [, m, dd] = dt.split("-");
    return `<div class="dia">
      <b>${nomeDia(dt,i)}</b><small>${dd}/${m}</small>
      <div class="ico">${ic}</div>
      <div class="desc">${dsc}</div>
      <div class="t">${Math.round(d.temperature_2m_max[i])}°<i>${Math.round(d.temperature_2m_min[i])}°</i></div>
      <div class="ch">☂ ${d.precipitation_probability_max[i] ?? 0}%</div>
    </div>`;
  }).join("");

  $("resultado").innerHTML = `
    <section class="atual">
      <div class="topo">
        <div><h2>${local.name}</h2><div class="sub">${regiao}</div></div>
        <div class="hora">Atualizado às ${atualizado}</div>
      </div>
      <div class="corpo">
        <div class="temp"><div class="ico">${ico}</div>
          <div><strong>${Math.round(c.temperature_2m)}°C</strong><span>${desc}</span></div></div>
        <div class="grade">
          <div class="info"><span>Sensação</span><b>${Math.round(c.apparent_temperature)}°C</b></div>
          <div class="info"><span>Umidade</span><b>${c.relative_humidity_2m}%</b></div>
          <div class="info"><span>Vento</span><b>${c.wind_speed_10m} km/h</b></div>
          <div class="info"><span>Precipitação</span><b>${c.precipitation} mm</b></div>
          <div class="info"><span>Índice UV</span><b>${d.uv_index_max[0]}</b></div>
          <div class="info"><span>Nascer / Pôr do sol</span><b>${hora(d.sunrise[0])} / ${hora(d.sunset[0])}</b></div>
        </div>
      </div>
    </section>
    <section class="prev"><h3>Previsão para os próximos ${DIAS_PREVISAO} dias</h3><div class="dias">${dias}</div></section>`;
}

async function buscar(nome) {
  nome = nome.trim();
  limparErro();
  if (!nome) { mostrarErro("Digite o nome de uma cidade para buscar."); return; }
  $("carregando").style.display = "block";
  $("resultado").innerHTML = "";
  try {
    const local = await geocodificar(nome);                         // etapa 1
    const previsao = await buscarPrevisao(local.latitude, local.longitude); // etapa 2
    renderizar(local, previsao);
  } catch (e) {
    const offline = e instanceof TypeError; // fetch lança TypeError em falha de rede
    mostrarErro(offline ? "Não foi possível conectar. Verifique sua internet e tente de novo." : e.message);
  } finally {
    $("carregando").style.display = "none";
  }
}

$("form").addEventListener("submit", e => { e.preventDefault(); buscar($("cidade").value); });

CIDADES.forEach(nome => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = nome;
  b.addEventListener("click", () => { $("cidade").value = nome; buscar(nome); });
  $("chips").appendChild(b);
});

buscar($("cidade").value);