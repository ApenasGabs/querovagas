export interface LocationOptionItem {
  value: string;
  label: string;
}

export interface LocationGroup {
  label: string;
  options: LocationOptionItem[];
}

export const CITY_QUERY_MAP: Record<string, string[]> = {
  CITY_SAO_PAULO: ["*São Paulo*", "*Sao Paulo*"],
  CITY_CAMPINAS: ["*Campinas*"],
  CITY_BARUERI: ["*Barueri*", "*Alphaville*"],
  CITY_RIBEIRAO_PRETO: ["*Ribeirão Preto*", "*Ribeirao Preto*"],
  CITY_SAO_CARLOS: ["*São Carlos*", "*Sao Carlos*"],
  CITY_SOROCABA: ["*Sorocaba*"],
  CITY_JUNDIAI: ["*Jundiaí*", "*Jundiai*"],
  CITY_HORTOLANDIA: ["*Hortolândia*", "*Hortolandia*"],
  CITY_SANTOS: ["*Santos*"],
  CITY_CURITIBA: ["*Curitiba*"],
  CITY_PORTO_ALEGRE: ["*Porto Alegre*"],
  CITY_BELO_HORIZONTE: ["*Belo Horizonte*"],
  CITY_RIO_DE_JANEIRO: ["*Rio de Janeiro*"],
  CITY_BRASILIA: ["*Brasília*", "*Brasilia*"],
  CITY_MANAUS: ["*Manaus*"],
  CITY_FLORIANOPOLIS: ["*Florianópolis*", "*Florianopolis*"],
  CITY_JOINVILLE: ["*Joinville*"],
  CITY_BLUMENAU: ["*Blumenau*"],
  CITY_SALVADOR: ["*Salvador*"],
  CITY_RECIFE: ["*Recife*"],
  CITY_FORTALEZA: ["*Fortaleza*"],
};

export const UF_QUERY_MAP: Record<string, { uf: string; names: string[] }> = {
  UF_SP: { uf: "SP", names: ["*São Paulo*", "*Sao Paulo*"] },
  UF_RJ: { uf: "RJ", names: ["*Rio de Janeiro*"] },
  UF_MG: { uf: "MG", names: ["*Minas Gerais*", "*Belo Horizonte*"] },
  UF_PR: { uf: "PR", names: ["*Paraná*", "*Parana*", "*Curitiba*"] },
  UF_RS: { uf: "RS", names: ["*Rio Grande do Sul*", "*Porto Alegre*"] },
  UF_SC: {
    uf: "SC",
    names: ["*Santa Catarina*", "*Florianópolis*", "*Blumenau*", "*Joinville*"],
  },
  UF_DF: { uf: "DF", names: ["*Distrito Federal*", "*Brasília*", "*Brasilia*"] },
  UF_AM: { uf: "AM", names: ["*Amazonas*", "*Manaus*"] },
  UF_BA: { uf: "BA", names: ["*Bahia*", "*Salvador*"] },
  UF_PE: { uf: "PE", names: ["*Pernambuco*", "*Recife*"] },
  UF_CE: { uf: "CE", names: ["*Ceará*", "*Ceara*", "*Fortaleza*"] },
};

export const LOCATION_SELECT_GROUPS: LocationGroup[] = [
  {
    label: "📍 Regiões em Destaque",
    options: [
      {
        value: "SP_REGION",
        label: "📍 São Paulo e Região (SP Capital, Campinas, Barueri...) — Padrão",
      },
      {
        value: "ALL",
        label: "🌐 Todas as localidades (Brasil & Global / 3.900+ vagas)",
      },
      {
        value: "BRASIL",
        label: "🇧🇷 Todo o Brasil (Vagas Nacionais & Remoto)",
      },
      {
        value: "INTERNACIONAL",
        label: "🌍 Internacional (EUA, Europa, Remoto Global)",
      },
    ],
  },
  {
    label: "🏢 Cidades - São Paulo & Região Metropolitana",
    options: [
      { value: "CITY_SAO_PAULO", label: "São Paulo (Capital)" },
      { value: "CITY_CAMPINAS", label: "Campinas (SP)" },
      { value: "CITY_BARUERI", label: "Barueri / Alphaville (SP)" },
      { value: "CITY_RIBEIRAO_PRETO", label: "Ribeirão Preto (SP)" },
      { value: "CITY_SAO_CARLOS", label: "São Carlos (SP)" },
      { value: "CITY_SOROCABA", label: "Sorocaba (SP)" },
      { value: "CITY_JUNDIAI", label: "Jundiaí (SP)" },
      { value: "CITY_HORTOLANDIA", label: "Hortolândia / Sumaré (SP)" },
      { value: "CITY_SANTOS", label: "Santos / Baixada (SP)" },
    ],
  },
  {
    label: "🏛️ Filtrar por Estado (UF)",
    options: [
      { value: "UF_SP", label: "São Paulo (Estado inteiro)" },
      { value: "UF_RJ", label: "Rio de Janeiro (RJ)" },
      { value: "UF_MG", label: "Minas Gerais (MG)" },
      { value: "UF_PR", label: "Paraná (PR)" },
      { value: "UF_RS", label: "Rio Grande do Sul (RS)" },
      { value: "UF_SC", label: "Santa Catarina (SC)" },
      { value: "UF_DF", label: "Distrito Federal (DF)" },
      { value: "UF_AM", label: "Amazonas (AM)" },
      { value: "UF_BA", label: "Bahia (BA)" },
      { value: "UF_PE", label: "Pernambuco (PE)" },
      { value: "UF_CE", label: "Ceará (CE)" },
    ],
  },
  {
    label: "🌆 Principais Cidades em Outros Estados",
    options: [
      { value: "CITY_CURITIBA", label: "Curitiba (PR)" },
      { value: "CITY_PORTO_ALEGRE", label: "Porto Alegre (RS)" },
      { value: "CITY_BELO_HORIZONTE", label: "Belo Horizonte (MG)" },
      { value: "CITY_RIO_DE_JANEIRO", label: "Rio de Janeiro (RJ)" },
      { value: "CITY_BRASILIA", label: "Brasília (DF)" },
      { value: "CITY_MANAUS", label: "Manaus (AM)" },
      { value: "CITY_FLORIANOPOLIS", label: "Florianópolis (SC)" },
      { value: "CITY_JOINVILLE", label: "Joinville (SC)" },
      { value: "CITY_BLUMENAU", label: "Blumenau (SC)" },
      { value: "CITY_SALVADOR", label: "Salvador (BA)" },
      { value: "CITY_RECIFE", label: "Recife (PE)" },
      { value: "CITY_FORTALEZA", label: "Fortaleza (CE)" },
    ],
  },
];
