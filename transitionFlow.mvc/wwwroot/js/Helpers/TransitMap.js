class TransitMap {
    constructor(elementId, options = {}) {
        this.elementId = elementId;
        this.defaultCenter = options.center || [48.1444, 23.0325];
        this.defaultZoom = options.zoom || 14;
        this.map = null;
        this.stopColorMap = {};
        this.stopsData = [];
        this.routesData = [];
        this.activeRouteFilter = null;
        this.vehiclesData = [];
        this._mapClickHandler = null;
        this.pendingMarker = null;
        this.markers = {};
        this.routeLines = {};
        this.previewPolyline = null;
        this._previewRequestId = 0;
        this.vehicleMarkers = {};
        this.vehicleProgress = {};
        this.animationInterval = null;

        this._changeCallbacks = [];

        this.init();
    }

    init() {
        if ($(`#${this.elementId}`).length === 0) return;

        this.map = L.map(this.elementId).setView(this.defaultCenter, this.defaultZoom);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    }

    onMapChange(callback) {
        if (typeof callback === 'function') {
            this._changeCallbacks.push(callback);
        }
        return this;
    }

    offMapChange(callback) {
        this._changeCallbacks = this._changeCallbacks.filter(cb => cb !== callback);
    }

    _emitMapChange(e = null) {
        const stats = this.getVisibleStats();
        this._changeCallbacks.forEach(cb => {
            try {
                cb(e, stats);
            } catch (err) {
                console.error('onMapChange callback error:', err);
            }
        });
    }

    createVehicleIcon(color, type) {
        const emoji = type === "Tram" ? "🚋" : type === "Trolleybus" ? "🚎" : type === "Minibus" ? "🚐" : "🚌";
        return L.divIcon({
            className: "",
            html: `<div style="background:${color};color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 8px rgba(0,0,0,0.35);border:2px solid white;">${emoji}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
    }

    interpolatePoints(p1, p2, t) {
        return [
            p1[0] + (p2[0] - p1[0]) * t,
            p1[1] + (p2[1] - p1[1]) * t
        ];
    }

    renderAndAnimateVehicles(vehicles, routes, stops) {
        if (!this.map) return;

        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }

        this.vehiclesData = Array.isArray(vehicles) ? [...vehicles] : [];
        this.routesData = Array.isArray(routes) ? [...routes] : [];
        this.stopsData = Array.isArray(stops) ? [...stops] : [];

        const onRouteVehicles = vehicles.filter(v => v.status === "OnRoute" && v.routeId);

        onRouteVehicles.forEach(v => {
            if (this.vehicleProgress[v.id] === undefined) {
                this.vehicleProgress[v.id] = Math.random() * 0.9;
            }
        });

        this.animationInterval = setInterval(() => {
            onRouteVehicles.forEach(v => {
                const route = routes.find(r => r.id === v.routeId);

                if (!route || !route.stops || route.stops.length < 2) return;
                let points = [];
                const polylineLayer = this.routeLines[v.routeId];

                if (polylineLayer) {
                    points = polylineLayer.getLatLngs().map(latlng => [latlng.lat, latlng.lng]);
                } else {
                    points = route.stops
                        .map(sid => stops.find(s => s.id === sid))
                        .filter(Boolean)
                        .map(s => [s.latitude, s.longitude]);
                }
                if (points.length < 2) return;

                let progress = this.vehicleProgress[v.id] || 0;
                progress += 0.001 + Math.random() * 0.001;
                if (progress > 1) progress = 0;
                this.vehicleProgress[v.id] = progress;

                const totalSegments = points.length - 1;
                const segProgress = progress * totalSegments;
                const segIdx = Math.min(Math.floor(segProgress), totalSegments - 1);
                const t = segProgress - segIdx;

                const currentPos = this.interpolatePoints(points[segIdx], points[segIdx + 1], t);
                const routeColor = route.color || "#3B82F6";

                if (this.vehicleMarkers[v.id]) {
                    this.vehicleMarkers[v.id].setLatLng(currentPos);
                } else {
                    const typeLabel = v.type === "Tram" ? "Трамвай" : v.type === "trolleybus" ? "Тролейбус" : "Автобус";
                    const marker = L.marker(currentPos, {
                        icon: this.createVehicleIcon(routeColor, v.type)
                    }).bindPopup(`
    <div style="font-family: var(--font-body); font-size: 14px;">
        <div style="font-weight: bold;">${v.plateNumber}</div>
        <div style="font-size: 12px; color: #6B7280;">${typeLabel} · ${v.model}</div>
        <div style="font-size: 12px; margin-top: 2px;">Маршрут №${route.number}</div>
    </div>
`);

                    const passesFilter = this.activeRouteFilter === null || Number(v.routeId) === this.activeRouteFilter;
                    if (passesFilter) {
                        marker.addTo(this.map);
                    }

                    this.vehicleMarkers[v.id] = marker;
                }
            });

            const activeIds = onRouteVehicles.map(v => v.id);
            Object.keys(this.vehicleMarkers).forEach(id => {
                if (!activeIds.includes(Number(id))) {
                    this.map.removeLayer(this.vehicleMarkers[id]);
                    delete this.vehicleMarkers[id];
                    delete this.vehicleProgress[id];
                }
            });

        }, 100);

        this._emitMapChange();
    }

    createStopIcon(color) {
        return L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    }

    mapRouteColors(routes) {
        this.stopColorMap = {};
        $.each(routes, (index, route) => {
            if (route.stops) {
                $.each(route.stops, (idx, stopId) => {
                    this.stopColorMap[stopId] = route.color || '#3B82F6';
                });
            }
        });
    }

    renderStops(stops, routes = []) {
        if (!this.map) return;

        Object.values(this.markers).forEach(marker => {
            this.map.removeLayer(marker);
        });

        this.stopsData = Array.isArray(stops) ? [...stops] : [];
        this.routesData = Array.isArray(routes) ? [...routes] : [];
        this.mapRouteColors(routes);
        this.markers = {};

        $.each(stops, (index, stop) => {
            this.addStop(stop, false);
        });

        this._emitMapChange();
    }

    addStop(stop, emit = true) {
        if (!this.map || !stop) return null;

        const stopId = Number(stop.id ?? stop.Id);
        const latitude = Number(stop.latitude ?? stop.Latitude);
        const longitude = Number(stop.longitude ?? stop.Longitude);
        const stopName = stop.name ?? stop.Name ?? '';

        if (Number.isNaN(stopId) || Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return null;
        }

        const markerColor = this.stopColorMap[stopId] || '#6B7280';
        const typeLabel = stop.type === 'combined' || stop.Type === 'combined' ? 'Комбінована' : 'Стандартна';

        if (this.markers[stopId]) {
            this.map.removeLayer(this.markers[stopId]);
        }

        const marker = L.marker([latitude, longitude], {
            icon: this.createStopIcon(markerColor)
        })
            .bindPopup(`
                <div style="font-family: var(--font-body); font-size: 14px;">
                    <div class="popup-stop-name" style="font-weight: bold; color: var(--color-text);">${stopName}</div>
                    <div style="color: var(--color-muted); font-size: 12px; margin-top:2px;">${typeLabel} зупинка</div>
                </div>
            `)
            .addTo(this.map);

        this.markers[stopId] = marker;
        this.stopsData.push({
            id: stopId,
            name: stopName,
            latitude,
            longitude
        });

        if (emit) {
            this._emitMapChange();
        }

        return marker;
    }

    removeStop(stopId) {
        if (!this.map) return;

        const numericStopId = Number(stopId);
        const marker = this.markers[numericStopId];

        if (marker) {
            this.map.removeLayer(marker);
            delete this.markers[numericStopId];
        }

        this.stopsData = this.stopsData.filter(stop => Number(stop.id ?? stop.Id) !== numericStopId);

        if (Array.isArray(this.routesData) && this.routesData.length > 0) {
            void this.renderRoutes(this.routesData, this.stopsData);
        }

        this._emitMapChange();
    }

    async fetchOSRMRoute(coords) {
        if (coords.length < 2) return null;

        const coordString = coords.map(c => `${c[1]},${c[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('OSRM network response was not ok');

            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            }
        } catch (error) {
            console.error("Failed to fetch road path from OSRM:", error);
        }
        return null;
    }

    async renderRoutes(routes, stops) {
        if (!this.map) return;

        $.each(this.routeLines, (id, line) => {
            this.map.removeLayer(line);
        });
        this.routeLines = {};
        this.routesData = Array.isArray(routes) ? [...routes] : [];

        for (const route of routes) {
            if (!route.stops || route.stops.length < 2) continue;
            const stopCoords = [];
            for (const stopId of route.stops) {
                const targetStop = stops.find(s => s.id === stopId);
                if (targetStop) {
                    stopCoords.push([targetStop.latitude, targetStop.longitude]);
                }
            }

            if (stopCoords.length < 2) continue;

            let pathPoints = await this.fetchOSRMRoute(stopCoords);
            if (!pathPoints) {
                pathPoints = stopCoords;
            }

            const polyline = L.polyline(pathPoints, {
                color: route.color || '#3B82F6',
                weight: 4,
                opacity: 0.85
            }).addTo(this.map);

            this.routeLines[route.id] = polyline;
        }

        this._emitMapChange();
    }

    updateStopPopup(id, newName) {
        const marker = this.markers[id];
        if (!marker) return;

        const popup = marker.getPopup();
        if (popup) {
            const currentContent = popup.getContent();
            const $html = $(`<div>${currentContent}</div>`);
            $html.find('.popup-stop-name').text(newName);
            marker.setPopupContent($html.html());
        }

        this._emitMapChange();
    }

    enableMapClickSelection(onMapClick) {
        this.disableMapClickSelection();
        this.map.getContainer().style.cursor = 'crosshair';

        this._mapClickHandler = (e) => {
            const { lat, lng } = e.latlng;
            const fixedLat = lat.toFixed(6);
            const fixedLon = lng.toFixed(6);

            if (this.pendingMarker) {
                this.pendingMarker.setLatLng([fixedLat, fixedLon]);
            } else {
                this.pendingMarker = L.marker([fixedLat, fixedLon], {
                    icon: this.createStopIcon('#10B981')
                }).addTo(this.map);
            }

            if (typeof onMapClick === 'function') {
                onMapClick(fixedLat, fixedLon);
            }
        };

        this.map.on('click', this._mapClickHandler);
    }

    disableMapClickSelection() {
        if (this.map) {
            this.map.getContainer().style.cursor = '';
            if (this._mapClickHandler) {
                this.map.off('click', this._mapClickHandler);
                this._mapClickHandler = null;
            }

            if (this.pendingMarker) {
                this.map.removeLayer(this.pendingMarker);
                this.pendingMarker = null;
            }
        }
    }

    enableRouteStopsSelection(allStops, currentStopIds, onStopSelected) {
        this.disableRouteStopsSelection();
        this._allStops = allStops;
        this._selectedStopIds = [...currentStopIds];

        this._originalIcons = {};

        this.updatePreviewRoute();

        $.each(this.markers, (stopId, marker) => {
            const numericId = Number(stopId);

            if (marker.getPopup()) {
                marker._savedPopup = marker.getPopup();
                marker.unbindPopup();
            }

            this._originalIcons[numericId] = marker.options.icon;

            if (this._selectedStopIds.includes(numericId)) {
                marker.setIcon(this.createHighlightIcon('#10B981'));
            }

            marker._routeSelectHandler = async (e) => {
                if (e && e.originalEvent) e.originalEvent.stopPropagation();

                if (!this._selectedStopIds.includes(numericId)) {
                    this._selectedStopIds.push(numericId);
                    marker.setIcon(this.createHighlightIcon('#10B981'));
                } else {
                    this._selectedStopIds = this._selectedStopIds.filter(id => id !== numericId);
                    marker.setIcon(this._originalIcons[numericId]);
                }

                await this.updatePreviewRoute();

                if (typeof onStopSelected === 'function') {
                    onStopSelected(this._selectedStopIds);
                }
            };

            marker.on('click', marker._routeSelectHandler);
        });
    }

    createHighlightIcon(color) {
        return L.divIcon({
            className: '',
            html: `<div style="width:20px;height:20px;background:${color};border:4px solid white;border-radius:50%;box-shadow:0 0 12px ${color}, 0 2px 6px rgba(0,0,0,0.4);transition: all 0.2s ease;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }

    async updatePreviewRoute() {
        const requestId = ++this._previewRequestId;

        if (this.previewPolyline) {
            this.map.removeLayer(this.previewPolyline);
            this.previewPolyline = null;
        }

        if (!this._selectedStopIds || this._selectedStopIds.length < 2) return;

        const stopCoords = [];
        for (const stopId of this._selectedStopIds) {
            const targetStop = this._allStops.find(s => s.id === stopId || s.Id === stopId);
            if (targetStop) {
                stopCoords.push([targetStop.latitude || targetStop.Latitude, targetStop.longitude || targetStop.Longitude]);
            }
        }
        if (stopCoords.length < 2) return;

        let pathPoints = await this.fetchOSRMRoute(stopCoords);

        if (requestId !== this._previewRequestId) return;

        if (!pathPoints) pathPoints = stopCoords;

        this.previewPolyline = L.polyline(pathPoints, {
            color: '#10B981',
            weight: 5,
            opacity: 0.75,
            dashArray: '10, 10'
        }).addTo(this.map);
    }

    disableRouteStopsSelection() {
        this._previewRequestId++
        $.each(this.markers, (stopId, marker) => {
            const numericId = Number(stopId);

            if (marker._routeSelectHandler) {
                marker.off('click', marker._routeSelectHandler);
                delete marker._routeSelectHandler;
            }

            if (marker._savedPopup) {
                marker.bindPopup(marker._savedPopup);
                delete marker._savedPopup;
            }

            if (this._originalIcons && this._originalIcons[numericId]) {
                marker.setIcon(this._originalIcons[numericId]);
            }
        });

        if (this.previewPolyline) {
            this.map.removeLayer(this.previewPolyline);
            this.previewPolyline = null;
        }

        this._selectedStopIds = [];
        this._allStops = [];
        this._originalIcons = {};
    }

    focusOnPoint(id, lat, lon, zoom = 16) {
        if (!this.map) return;

        this.map.flyTo([lat, lon], zoom, {
            animate: true,
            duration: 1.2
        });

        if (this.markers[id]) {
            this.markers[id].openPopup();
        }
    }

    focusOnRoute(routeId) {
        if (!this.map) return;

        const polyline = this.routeLines[routeId];
        if (polyline) {
            const bounds = polyline.getBounds();

            this.map.flyToBounds(bounds, {
                animate: true,
                duration: 1.2,
                padding: [50, 50]
            });
        } else {
            console.warn(`Route line with ID ${routeId} not found on the map.`);
        }
    }

    focusOnVehicle(vehicleId, zoom = 16) {
        if (!this.map) return;

        const marker = this.vehicleMarkers[vehicleId];
        if (marker) {
            const latlng = marker.getLatLng();
            this.map.flyTo(latlng, zoom, {
                animate: true,
                duration: 1.2
            });
            marker.openPopup();
        } else {
            console.warn(`Vehicle marker with ID ${vehicleId} not found or not active on the map.`);
        }
    }

    addVehicle(vehicle) {
        if (!vehicle) return null;

        const normalizedVehicle = {
            ...vehicle,
            id: Number(vehicle.id ?? vehicle.Id),
            routeId: vehicle.routeId ?? vehicle.RouteId ?? null,
            status: vehicle.status ?? vehicle.Status ?? ''
        };

        if (Number.isNaN(normalizedVehicle.id)) {
            return null;
        }

        const existingIndex = this.vehiclesData.findIndex(item => Number(item.id ?? item.Id) === normalizedVehicle.id);
        if (existingIndex >= 0) {
            this.vehiclesData[existingIndex] = normalizedVehicle;
        } else {
            this.vehiclesData.push(normalizedVehicle);
        }

        this.renderAndAnimateVehicles(this.vehiclesData, this.routesData, this.stopsData);
        return normalizedVehicle;
    }

    removeVehicle(vehicleId) {
        const numericVehicleId = Number(vehicleId);
        this.vehiclesData = this.vehiclesData.filter(item => Number(item.id ?? item.Id) !== numericVehicleId);

        if (!this.map) return;

        if (this.vehicleMarkers[numericVehicleId]) {
            this.map.removeLayer(this.vehicleMarkers[numericVehicleId]);
            delete this.vehicleMarkers[numericVehicleId];
            delete this.vehicleProgress[numericVehicleId];
        }

        this.renderAndAnimateVehicles(this.vehiclesData, this.routesData, this.stopsData);
    }

    async addRoute(routeId, stopIds, color, routeMeta = {}) {
        if (!this.map || !stopIds || stopIds.length < 2) return;

        if (this.routeLines[routeId]) {
            this.map.removeLayer(this.routeLines[routeId]);
            delete this.routeLines[routeId];
        }

        const stopCoords = [];
        for (const stopId of stopIds) {
            const marker = this.markers[stopId];
            if (marker) {
                const latlng = marker.getLatLng();
                stopCoords.push([latlng.lat, latlng.lng]);
            }
        }

        if (stopCoords.length < 2) return;

        let pathPoints = await this.fetchOSRMRoute(stopCoords);
        if (!pathPoints) {
            pathPoints = stopCoords;
        }

        const polyline = L.polyline(pathPoints, {
            color: color || '#3B82F6',
            weight: 4,
            opacity: 0.85
        }).addTo(this.map);

        this.routeLines[routeId] = polyline;

        // Keep routesData in sync so any UI relying on it (filters, selects) updates automatically
        const numericRouteId = Number(routeId);
        const existingIndex = this.routesData.findIndex(r => Number(r.id) === numericRouteId);
        const routeEntry = { id: numericRouteId, stops: stopIds, color, ...routeMeta };
        if (existingIndex >= 0) {
            this.routesData[existingIndex] = { ...this.routesData[existingIndex], ...routeEntry };
        } else {
            this.routesData.push(routeEntry);
        }

        this._emitMapChange();
    }

    deleteRoute(routeId) {
        if (!this.map) return;

        if (this.routeLines[routeId]) {
            this.map.removeLayer(this.routeLines[routeId]);
            delete this.routeLines[routeId];
        }

        const numericRouteId = Number(routeId);
        this.routesData = this.routesData.filter(r => Number(r.id) !== numericRouteId);

        this.vehiclesData = this.vehiclesData.map(v => {
            const vRouteId = v.routeId ?? v.RouteId;
            if (Number(vRouteId) === numericRouteId) {
                return { ...v, routeId: null };
            }
            return v;
        });

        this.renderAndAnimateVehicles(this.vehiclesData, this.routesData, this.stopsData);
    }

    setRouteFilter(routeId) {
        this.activeRouteFilter = routeId === null ? null : Number(routeId);
        this.applyRouteFilter();
    }

    applyRouteFilter() {
        if (!this.map) return;
        const filter = this.activeRouteFilter;

        $.each(this.routeLines, (id, line) => {
            const show = filter === null || Number(id) === filter;
            if (show && !this.map.hasLayer(line)) line.addTo(this.map);
            if (!show && this.map.hasLayer(line)) this.map.removeLayer(line);
        });

        const selectedRoute = filter === null
            ? null
            : this.routesData.find(r => Number(r.id) === filter);
        const stopIdsForRoute = selectedRoute?.stops?.map(Number) ?? null;

        $.each(this.markers, (stopId, marker) => {
            const show = filter === null || (stopIdsForRoute && stopIdsForRoute.includes(Number(stopId)));
            if (show && !this.map.hasLayer(marker)) marker.addTo(this.map);
            if (!show && this.map.hasLayer(marker)) this.map.removeLayer(marker);
        });

        $.each(this.vehicleMarkers, (vehicleId, marker) => {
            const vehicle = this.vehiclesData.find(v => Number(v.id ?? v.Id) === Number(vehicleId));
            const show = filter === null || (vehicle && Number(vehicle.routeId) === filter);
            if (show && !this.map.hasLayer(marker)) marker.addTo(this.map);
            if (!show && this.map.hasLayer(marker)) this.map.removeLayer(marker);
        });

        this._emitMapChange();
    }

    getVisibleStats() {
        if (!this.map) {
            return { routes: 0, stops: 0, vehicles: 0, onRoute: 0, routesData: [] };
        }

        let visibleRoutes = 0;
        $.each(this.routeLines, (id, line) => {
            if (this.map.hasLayer(line)) visibleRoutes++;
        });

        let visibleStops = 0;
        $.each(this.markers, (id, marker) => {
            if (this.map.hasLayer(marker)) visibleStops++;
        });

        let onRoute = 0;
        $.each(this.vehiclesData, (index, vehicle) => {
            const status = vehicle.status ?? vehicle.Status;
            const routeId = vehicle.routeId ?? vehicle.RouteId;
            const matchesFilter = this.activeRouteFilter === null || Number(routeId) === this.activeRouteFilter;
            if (status === 'OnRoute' && matchesFilter) {
                onRoute++;
            }
        });

        return {
            allRoutes: Object.keys(this.routeLines).length,
            routes: visibleRoutes,
            allStops: Object.keys(this.markers).length,
            stops: visibleStops,
            allVehicles: this.vehiclesData.length,
            vehicles: this.vehiclesData.length,
            onRoute,
            routesData: this.routesData
        };
    }
}

export default TransitMap;