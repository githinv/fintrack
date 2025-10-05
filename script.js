let lineChart, pieChart, barChart, netBarChart;
let allData = [];
let filteredDataForCharts = [];

// Load CSV
function loadCSV() {
  const fileInput = document.getElementById("csvFile").files[0];
  if (!fileInput) {
    alert("Please upload a CSV file");
    return;
  }

  Papa.parse(fileInput, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      allData = results.data;
      filteredDataForCharts = [...allData]; // default for all charts
      renderData(filteredDataForCharts);
      updateBarChart();
      drawNetBarChart(filteredDataForCharts);
    }
  });
}

// Render summary + line + pie + populate categories
function renderData(data) {
  const categories = {};
  const monthly = {};
  const uniqueCategories = new Set();

  const tableBody = document.querySelector("#transactionsTable tbody");
  tableBody.innerHTML = "";

  if (!data || data.length === 0) {
    showChartPlaceholder("lineChart", "No data to display");
    showChartPlaceholder("pieChart", "No data to display");
    document.getElementById("totalIncome").textContent = "₹0";
    document.getElementById("totalSpend").textContent = "₹0";
    document.getElementById("netBalance").textContent = "₹0";
    return;
  }

  // Build monthly sums for line chart & net calculation
  data.forEach(row => {
    const dateStr = row["Date"]?.trim();
    if (!dateStr) return;

    const spend = parseFloat(row["Spend"]) || 0;
    const credit = parseFloat(row["Credit"]) || 0;
    const category = row["Category"]?.trim() || "Other";
    const desc = row["Description"]?.trim() || "";

    categories[category] = (categories[category] || 0) + spend;
    uniqueCategories.add(category);

    const parts = dateStr.split("-");
    const monthLabel = `${parts[2]}-${parts[1]}`; // yyyy-mm
    if (!monthly[monthLabel]) monthly[monthLabel] = { income: 0, spend: 0 };
    monthly[monthLabel].income += credit;
    monthly[monthLabel].spend += spend;

    // Populate Transactions table
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${desc}</td>
      <td>${spend ? "₹"+spend.toFixed(2) : "-"}</td>
      <td>${credit ? "₹"+credit.toFixed(2) : "-"}</td>
      <td>₹${(credit-spend).toFixed(2)}</td>
      <td>${category}</td>
    `;
    tableBody.appendChild(tr);
  });

  // ✅ Calculate totals from monthly sums (line chart)
  const totalIncome = Object.values(monthly).reduce((sum, m) => sum + m.income, 0);
  const totalSpend = Object.values(monthly).reduce((sum, m) => sum + m.spend, 0);
  const netBalance = totalIncome - totalSpend;

  document.getElementById("totalIncome").textContent = `₹${totalIncome.toFixed(2)}`;
  document.getElementById("totalSpend").textContent = `₹${totalSpend.toFixed(2)}`;
  document.getElementById("netBalance").textContent = `₹${netBalance.toFixed(2)}`;

  drawCharts(monthly, categories);

  // Populate Category dropdown for bar chart
  const filterDropdown = document.getElementById("categoryFilterBar");
  if (filterDropdown) {
    const currentValue = filterDropdown.value; 
    filterDropdown.innerHTML = `<option value="all">All Categories</option>`;
    uniqueCategories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      if (cat === currentValue) option.selected = true;
      filterDropdown.appendChild(option);
    });
  }
}

// Line + Pie charts (✅ includes total update feature)
function drawCharts(monthly, categories) {
  const months = Object.keys(monthly).sort();
  const incomeData = months.map(m => monthly[m].income);
  const spendData = months.map(m => monthly[m].spend);

  if (lineChart) lineChart.destroy();
  if (pieChart) pieChart.destroy();

  const ctx1 = document.getElementById("lineChart").getContext("2d");
  lineChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, borderColor: 'green', fill: false, tension: 0.4 },
        { label: 'Spend', data: spendData, borderColor: 'red', fill: false, tension: 0.4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      layout: { padding: { bottom: 20 } }
    }
  });

  // ----- PIE CHART -----
  const ctx2 = document.getElementById("pieChart").getContext("2d");
  const pieData = {
    labels: Object.keys(categories),
    datasets: [
      {
        data: Object.values(categories),
        backgroundColor: ['#ff6384','#36a2eb','#ffcd56','#4bc0c0','#9966ff','#c9cbcf']
      }
    ]
  };

  // 🔹 Create total label element (top-right)
  let totalLabel = document.getElementById("pieTotalLabel");
  if (!totalLabel) {
    totalLabel = document.createElement("div");
    totalLabel.id = "pieTotalLabel";
    totalLabel.style.position = "absolute";
    totalLabel.style.top = "10px";
    totalLabel.style.right = "15px";
    totalLabel.style.fontWeight = "600";
    totalLabel.style.padding = "6px 12px";
    totalLabel.style.borderRadius = "8px";
    totalLabel.style.background = "rgba(240, 240, 240, 0.9)";
    totalLabel.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
    totalLabel.style.fontSize = "0.9rem";
    totalLabel.style.color = "#222";
    const container = ctx2.canvas.closest(".chart-pie-container");
    container.style.position = "relative";
    container.appendChild(totalLabel);
  }

  const pieConfig = {
    type: 'pie',
    data: pieData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          onClick: function(e, legendItem, legend) {
            const index = legendItem.index;
            const ci = legend.chart;
            ci.toggleDataVisibility(index);
            ci.update();
            updatePieTotal(ci);
          }
        }
      }
    },
    plugins: [{
      id: 'updateTotalOnInit',
      afterInit: (chart) => updatePieTotal(chart),
      afterUpdate: (chart) => updatePieTotal(chart)
    }]
  };

  pieChart = new Chart(ctx2, pieConfig);
}

// 🔹 Helper to update visible total
function updatePieTotal(chart) {
  const dataset = chart.data.datasets[0];
  let total = 0;
  dataset.data.forEach((v, i) => {
    if (!chart.getDataVisibility(i)) return;
    total += v;
  });
  const totalLabel = document.getElementById("pieTotalLabel");
  if (totalLabel) {
    totalLabel.textContent = `Total: ₹${total.toFixed(2)}`;
  }
}

// 🔹 Bar Chart (Weekly / Monthly)
function updateBarChart() {
  const selected = document.getElementById("categoryFilterBar").value;
  const view = document.getElementById("timeView").value;

  const baseData = filteredDataForCharts.length ? filteredDataForCharts : allData;

  const filteredData = selected === "all"
    ? baseData
    : baseData.filter(row => (row["Category"]?.trim() || "Other") === selected);

  const grouped = {};
  filteredData.forEach(row => {
    const dateStr = row["Date"]?.trim() || "";
    const spend = parseFloat(row["Spend"]) || 0;
    if (!dateStr) return;

    const parts = dateStr.split("-");
    const year = parts[2], month = parts[1], day = parts[0];
    const dateObj = new Date(`${year}-${month}-${day}`);

    const key = view === "monthly" ? `${year}-${month}` : `${year}-W${getWeekNumber(dateObj)}`;
    grouped[key] = (grouped[key] || 0) + spend;
  });

  const labels = Object.keys(grouped).sort((a,b)=>{
    if(view==="weekly"){
      const [yA,wA]=a.split('-W').map(Number); const [yB,wB]=b.split('-W').map(Number);
      return yA!==yB ? yA-yB : wA-wB;
    } else return a.localeCompare(b);
  });
  const values = labels.map(k=>grouped[k]);

  if (barChart) barChart.destroy();
  const ctx = document.getElementById("barChart").getContext("2d");
  barChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label: selected==="all"?"Total Spend":`${selected} Spend`, data: values, backgroundColor:'#36a2eb' }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  renderTransactions(filteredData);
}

// 🔹 Helper: get ISO week number
function getWeekNumber(d){
  d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/86400000)+1)/7);
}

// Render transactions table
function renderTransactions(data){
  const tableBody=document.querySelector("#transactionsTable tbody");
  tableBody.innerHTML="";
  data.forEach(row=>{
    const spend=parseFloat(row["Spend"])||0;
    const credit=parseFloat(row["Credit"])||0;
    const balance=parseFloat(row["Balance"])||0;
    const desc=row["Description"]||"";
    const category=row["Category"]||"Other";
    const dateStr=row["Date"]||"";

    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${dateStr}</td>
      <td>${desc}</td>
      <td>${spend?"₹"+spend.toFixed(2):"-"}</td>
      <td>${credit?"₹"+credit.toFixed(2):"-"}</td>
      <td>₹${balance.toFixed(2)}</td>
      <td>${category}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// Date filter
function filterByDate() {
  const start=document.getElementById("startDate").value;
  const end=document.getElementById("endDate").value;
  if(!start||!end){ alert("Please select both start and end dates"); return; }

  const filtered = allData.filter(row=>{
    const dateParts=row["Date"].split("-");
    const dateObj=new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
    return dateObj>=new Date(start)&&dateObj<=new Date(end);
  });

  filteredDataForCharts = [...filtered];
  renderData(filtered);
  updateBarChart();
  drawNetBarChart(filtered); 
}

function resetFilter() {
  document.getElementById("startDate").value="";
  document.getElementById("endDate").value="";
  filteredDataForCharts = [...allData];
  renderData(allData);
  updateBarChart();
  drawNetBarChart(allData);
}

// Dark mode toggle
function toggleDarkMode(){ document.body.classList.toggle("dark-mode"); }

// Placeholder helpers
function showChartPlaceholder(canvasId,message){
  const canvas=document.getElementById(canvasId); canvas.style.display="none";
  const parent=canvas.parentElement;
  const placeholder=document.createElement("div");
  placeholder.id=canvasId+"_placeholder"; placeholder.className="chart-placeholder";
  placeholder.textContent=message; parent.appendChild(placeholder);
}
function removeChartPlaceholder(canvasId){
  const placeholder=document.getElementById(canvasId+"_placeholder");
  if(placeholder){ placeholder.remove(); document.getElementById(canvasId).style.display="block"; }
}

// 🔹 Net Income Bar Chart
function drawNetBarChart(data){
  const monthly={};
  data.forEach(row=>{
    const dateStr=row["Date"]?.trim(); if(!dateStr) return;
    const parts=dateStr.split("-");
    const year=parts[2], month=parts[1];
    const key=`${year}-${month}`;
    if(!monthly[key]) monthly[key]={ income:0, spend:0 };
    monthly[key].income += parseFloat(row["Credit"])||0;
    monthly[key].spend += parseFloat(row["Spend"])||0;
  });

  const labels=Object.keys(monthly).sort().slice(-12);
  const netValues=labels.map(k=>monthly[k].income-monthly[k].spend);

  if(netBarChart) netBarChart.destroy();
  const ctx=document.getElementById("netBarChart").getContext("2d");
  netBarChart=new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[{ label:'Net (Income - Spend)', data: netValues, backgroundColor: netValues.map(v=>v>=0?'lightgreen':'lightcoral') }]},
    options:{ responsive:true, maintainAspectRatio:false, layout:{ padding:{ bottom:20 } } }
  });
}
