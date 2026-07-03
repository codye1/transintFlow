import TransitMap from '../../Helpers/transitMap.js';
$(function () {
    window.TransitMapInstance = new TransitMap('transit-map', {
        center: [48.1444, 23.0325],
        zoom: 14
    });
    window.TransitMapInstance.onMapChange(function (e, stats) {
        $('#stat-routes-count').text(`${stats.allRoutes}`)
        $('#stat-routes-sub').text(`${stats.routes} на карті`);
        $('#stat-stops-count').text(`${stats.allStops}`)
        $('#stat-stops-sub').text(`${stats.stops} на карті`);
        $('#stat-vehicles-count').text(`${stats.allVehicles}`)
        $('#stat-vehicles-sub').text(`${stats.onRoute} на маршруті`);
        const activityPct = stats.vehicles > 0
            ? Math.round((stats.onRoute / stats.vehicles) * 100)
            : 0;
        $('#stat-activity-pct').text(`${activityPct}%`);
        syncRouteSelects(stats.routesData);
    });
    function syncRouteSelects(routes) {
        $('.route-select-target').each(function () {
            const $select = $(this);
            const currentValue = $select.val();
            const emptyValue = $select.data('empty-value');
            const emptyLabel = $select.data('empty-label');
            $select.empty();
            if (emptyValue !== undefined) {
                $select.append(new Option(emptyLabel, emptyValue));
            }
            routes.forEach(route => {
                $select.append(new Option(`№${route.number} — ${route.name}`, route.id));
            });
            const stillValid = routes.some(r => String(r.id) === String(currentValue))
                || String(currentValue) === String(emptyValue);
            if (stillValid) {
                $select.val(currentValue);
            } else if (emptyValue !== undefined) {
                $select.val(emptyValue).trigger('change');
            }
        });
    }
    $('#route-filter-select').on('change', function () {
        const value = $(this).val();
        window.TransitMapInstance.setRouteFilter(value === 'all' ? null : value);
    });
    async function setupMapData() {
        if (!window.TransitData) return;
        if (window.TransitData.stops) {
            window.TransitMapInstance.renderStops(window.TransitData.stops, window.TransitData.routes || []);
        }
        if (window.TransitData.routes && window.TransitData.stops) {
            await window.TransitMapInstance.renderRoutes(window.TransitData.routes, window.TransitData.stops);
        }
        if (window.TransitData.vehicles) {
            window.TransitMapInstance.renderAndAnimateVehicles(
                window.TransitData.vehicles,
                window.TransitData.routes || [],
                window.TransitData.stops || []
            );
        }
    }
    setupMapData();
    function switchTab(tabName, updateUrl = true) {
        const $targetTrigger = $(`.tab-trigger[data-tab="${tabName}"]`);
        const $targetPanel = $(`#panel-${tabName}`);
        if ($targetTrigger.length === 0) return;
        $('.tab-trigger').removeClass('active');
        $targetTrigger.addClass('active');
        $('.tab-panel').removeClass('active');
        $targetPanel.addClass('active');
        if (updateUrl) {
            history.pushState(null, null, `#${tabName}`);
        }
    }
    $('.tab-trigger').on('click', function () {
        const targetTab = $(this).data('tab');
        switchTab(targetTab);
    });
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash) {
        switchTab(currentHash, false);
    } else {
        switchTab('routes', false);
    }
    window.addEventListener('popstate', function () {
        const hash = window.location.hash.replace('#', '') || 'routes';
        switchTab(hash, false);
    });
});