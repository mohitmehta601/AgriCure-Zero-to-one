import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Droplets, Thermometer, Activity, Leaf, Clock, Plus, Edit, Trash2, MapPin, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchThingSpeakData, getMockThingSpeakData, ThingSpeakData } from "@/services/thingSpeakService";
import { recommendationService } from "@/services/recommendationService";
import { FertilizerRecommendation } from "@/services/supabaseClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { farmService, type Farm, type CreateFarmData, type UpdateFarmData } from "@/services/farmService";
import { getCropTypeOptions } from "@/services/fertilizerMLService";
import { useToast } from "@/hooks/use-toast";
import MLModelStatus from "./MLModelStatus";
import { LocationSoilService, type SoilData, type LocationData } from "@/services/locationSoilService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EnhancedFarmOverviewProps {
  user?: any;
}

const EnhancedFarmOverview = ({ user }: EnhancedFarmOverviewProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [realTimeData, setRealTimeData] = useState<ThingSpeakData | null>(null);
  const [recommendations, setRecommendations] = useState<FertilizerRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [deletingFarm, setDeletingFarm] = useState<Farm | null>(null);
  const [newFarm, setNewFarm] = useState({ 
    name: '', 
    size: '', 
    unit: 'hectares', 
    cropType: '', 
    soilType: '', 
    location: '',
    coordinates: null as LocationData | null,
    soilData: null as SoilData | null,
    sowingDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchThingSpeakData();
        if (data) {
          setRealTimeData(data);
        } else {
          setRealTimeData(getMockThingSpeakData());
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setRealTimeData(getMockThingSpeakData());
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadFarms();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadRecommendations();
    }
  }, [user]);

  const loadFarms = async () => {
    if (!user?.id) return;
    
    setFarmsLoading(true);
    try {
      const { data, error } = await farmService.getFarmsByUser(user.id);
      if (error) throw error;
      setFarms(data || []);
    } catch (error) {
      console.error('Error loading farms:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to load farms',
        variant: "destructive"
      });
    } finally {
      setFarmsLoading(false);
    }
  };

  const loadRecommendations = async () => {
    if (!user) return;
    
    setRecommendationsLoading(true);
    try {
      const { data, error } = await recommendationService.getRecentRecommendations(user.id, 5);
      if (error) throw error;
      setRecommendations(data || []);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleSaveFarm = async () => {
    if (!user?.id) return;
    
    const sizeNum = parseFloat(newFarm.size);
    if (!newFarm.name || isNaN(sizeNum) || !newFarm.cropType || !newFarm.soilType || !newFarm.location || !newFarm.soilData || !newFarm.sowingDate) {
      toast({
        title: t('common.error'),
        description: 'Please fill in all required fields including location detection and sowing date',
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (editingFarm) {
        const updateData: UpdateFarmData = {
          name: newFarm.name,
          size: sizeNum,
          unit: newFarm.unit as 'hectares' | 'acres' | 'bigha',
          crop_type: newFarm.cropType,
          soil_type: newFarm.soilType,
          location: newFarm.location || undefined,
          sowing_date: newFarm.sowingDate || undefined
        };
        
        const { data, error } = await farmService.updateFarm(editingFarm.id, updateData);
        if (error) throw error;
        
        toast({
          title: t('common.success'),
          description: 'Farm updated successfully',
        });
      } else {
        // Create new farm
        const farmData: CreateFarmData = {
          user_id: user.id,
          name: newFarm.name,
          size: sizeNum,
          unit: newFarm.unit as 'hectares' | 'acres' | 'bigha',
          crop_type: newFarm.cropType,
          soil_type: newFarm.soilType,
          location: newFarm.location,
          latitude: newFarm.coordinates?.latitude,
          longitude: newFarm.coordinates?.longitude,
          soil_data: newFarm.soilData,
          sowing_date: newFarm.sowingDate
        };
        
        const { data, error } = await farmService.createFarm(farmData);
        if (error) throw error;
        
        toast({
          title: t('common.success'),
          description: 'Farm added successfully',
        });
      }
      
      await loadFarms();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving farm:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to save farm',
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFarm = async () => {
    if (!deletingFarm) return;
    
    try {
      const { error } = await farmService.deleteFarm(deletingFarm.id);
      if (error) throw error;
      
      toast({
        title: t('common.success'),
        description: 'Farm deleted successfully',
      });
      
      await loadFarms();
      setDeletingFarm(null);
    } catch (error) {
      console.error('Error deleting farm:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to delete farm',
        variant: "destructive"
      });
    }
  };

  const handleEditFarm = (farm: Farm) => {
    setEditingFarm(farm);
    setNewFarm({
      name: farm.name,
      size: String(farm.size),
      unit: farm.unit,
      cropType: farm.crop_type,
      soilType: farm.soil_type,
      location: farm.location || '',
      coordinates: null,
      soilData: null,
      sowingDate: farm.sowing_date || ''
    });
    setIsAddOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddOpen(false);
    setEditingFarm(null);
    setNewFarm({ 
      name: '', 
      size: '', 
      unit: 'hectares', 
      cropType: '', 
      soilType: '', 
      location: '',
      coordinates: null,
      soilData: null,
      sowingDate: ''
    });
  };

  const handleGetLocation = async () => {
    if (!LocationSoilService.isGeolocationSupported()) {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support location detection',
        variant: "destructive"
      });
      return;
    }

    setFetchingLocation(true);
    try {
      const { location, soilData, locationString } = await LocationSoilService.getLocationAndSoilData();
      
      setNewFarm(prev => ({
        ...prev,
        location: locationString,
        coordinates: location,
        soilData: soilData,
        soilType: soilData.soil_type
      }));

      toast({
        title: 'Location Detected!',
        description: `Found ${soilData.soil_type} soil at ${locationString}`,
      });

    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: 'Location Error',
        description: error instanceof Error ? error.message : 'Failed to get location',
        variant: "destructive"
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  type NutrientType = 'nitrogen' | 'phosphorus' | 'potassium';

  const getNutrientStatus = (type: NutrientType, value: number) => {
    if (type === 'nitrogen') {
      if (value > 180) return { status: 'critical', color: 'text-red-600' };
      if (value >= 81) return { status: 'optimal', color: 'text-green-600' };
      return { status: 'warning', color: 'text-yellow-600' };
    }
    if (value > 350) return { status: 'critical', color: 'text-red-600' };
    if (value >= 111) return { status: 'optimal', color: 'text-green-600' };
    return { status: 'warning', color: 'text-yellow-600' };
  };

  const clampPercent = (percent: number) => Math.max(0, Math.min(100, percent));

  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

  const normalizeNitrogen = (n: number) => {
    if (n <= 80) return clamp01(n / 80);
    if (n <= 180) return 1;
    return clamp01(1 - (n - 180) / (240 - 180));
  };

  const normalizePhosphorus = (p: number) => {
    if (p <= 110) return clamp01(p / 110);
    if (p <= 350) return 1;
    return clamp01(1 - (p - 350) / (400 - 350));
  };

  const normalizePotassium = (k: number) => {
    if (k <= 110) return clamp01(k / 110);
    if (k <= 350) return 1;
    return clamp01(1 - (k - 350) / (400 - 350));
  };

  const normalizePH = (ph: number) => clamp01(1 - Math.abs(ph - 6.75) / 1.75);
  const normalizeSoilMoisture = (sm: number) => clamp01(1 - Math.abs(sm - 30) / 20);
  const normalizeTemperature = (t: number) => clamp01(1 - Math.abs(t - 25) / 10);
  const normalizeHumidity = (h: number) => clamp01(1 - Math.abs(h - 60) / 20);

  const computeSoilHealthIndex = (data: ThingSpeakData) => {
    const sn = normalizeNitrogen(data.nitrogen);
    const sp = normalizePhosphorus(data.phosphorus);
    const sk = normalizePotassium(data.potassium);
    const sph = normalizePH(data.soilPH);
    const ssm = normalizeSoilMoisture(data.soilMoisture);
    const st = normalizeTemperature(data.temperature);
    const sh = normalizeHumidity(data.humidity);

    const weighted = 0.2 * sn + 0.15 * sp + 0.15 * sk + 0.15 * sph + 0.15 * ssm + 0.1 * st + 0.1 * sh;
    return clampPercent(weighted * 100);
  };

  const classifySHI = (percent: number) => {
    if (percent >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800 border-green-200' };
    if (percent >= 60) return { label: 'Good', color: 'bg-lime-100 text-lime-800 border-lime-200' };
    if (percent >= 40) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'Poor', color: 'bg-red-100 text-red-800 border-red-200' };
  };

  const openFullReport = (rec: FertilizerRecommendation) => {
    navigate(`/recommendations/${rec.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-md">
              <CardContent className="p-3 sm:p-6">
                <div className="h-3 sm:h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded mb-2"></div>
                <div className="h-6 sm:h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const shiPercent = realTimeData ? computeSoilHealthIndex(realTimeData) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-grass-50 to-green-50">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">{t('dashboard.overallSoilHealth')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-grass-600 animate-pulse" />
              <span className="text-lg sm:text-2xl font-bold text-grass-700">{Math.round(shiPercent)}%</span>
              {(() => { const c = classifySHI(shiPercent); return (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded border ${c.color}`}>{c.label}</span>
              ); })()}
            </div>
            <Progress value={shiPercent} className="mt-2 h-2 bg-grass-100" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">{t('dashboard.soilMoisture')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center space-x-2">
              <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 animate-bounce" />
              <span className="text-lg sm:text-2xl font-bold text-blue-700">{realTimeData?.soilMoisture.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-orange-50 to-red-50">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">{t('dashboard.temperature')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center space-x-2">
              <Thermometer className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              <span className="text-lg sm:text-2xl font-bold text-orange-700">{realTimeData?.temperature.toFixed(1)}°C</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-cyan-50 to-blue-50">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">{t('dashboard.humidity')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center space-x-2">
              <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-600" />
              <span className="text-lg sm:text-2xl font-bold text-cyan-700">{realTimeData?.humidity.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NPK Levels */}
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl flex items-center space-x-2">
            <Leaf className="h-5 w-5 text-grass-600" />
            <span>{t('dashboard.npkLevels')}</span>
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">{t('dashboard.npkDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-2 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-green-800">{t('dashboard.nitrogen')}</span>
                <span className="text-sm text-green-600 font-semibold">{realTimeData?.nitrogen.toFixed(1)} mg/kg</span>
              </div>
              <Progress value={clampPercent(((realTimeData?.nitrogen ?? 0) / 240) * 100)} className="h-2 bg-green-100" />
              {(() => { const s = getNutrientStatus('nitrogen', realTimeData?.nitrogen ?? 0); return (
                <div className={`text-xs ${s.color}`}>{s.status.toUpperCase()}</div>
              ); })()}
            </div>
            <div className="space-y-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-blue-800">{t('dashboard.phosphorus')}</span>
                <span className="text-sm text-blue-600 font-semibold">{realTimeData?.phosphorus.toFixed(1)} mg/kg</span>
              </div>
              <Progress value={clampPercent(((realTimeData?.phosphorus ?? 0) / 400) * 100)} className="h-2 bg-blue-100" />
              {(() => { const s = getNutrientStatus('phosphorus', realTimeData?.phosphorus ?? 0); return (
                <div className={`text-xs ${s.color}`}>{s.status.toUpperCase()}</div>
              ); })()}
            </div>
            <div className="space-y-2 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-yellow-800">{t('dashboard.potassium')}</span>
                <span className="text-sm text-yellow-600 font-semibold">{realTimeData?.potassium.toFixed(1)} mg/kg</span>
              </div>
              <Progress value={clampPercent(((realTimeData?.potassium ?? 0) / 400) * 100)} className="h-2 bg-yellow-100" />
              {(() => { const s = getNutrientStatus('potassium', realTimeData?.potassium ?? 0); return (
                <div className={`text-xs ${s.color}`}>{s.status.toUpperCase()}</div>
              ); })()}
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500 flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>{t('dashboard.lastUpdated')}: {realTimeData ? new Date(realTimeData.timestamp).toLocaleString() : 'N/A'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Registered Farms */}
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-grass-600" />
            <span>{t('dashboard.registeredFarms')}</span>
          </CardTitle>
          <div className="flex items-center justify-between">
            <CardDescription className="text-sm sm:text-base">{t('dashboard.farmsDescription')}</CardDescription>
            <Button 
              size="sm" 
              onClick={() => setIsAddOpen(true)}
              className="bg-grass-600 hover:bg-grass-700 transition-all duration-300 hover:scale-105"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.addFarm') || 'Add Farm'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {farmsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-grass-600"></div>
              <span className="ml-2 text-sm">{t('common.loading')}</span>
            </div>
          ) : farms.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-600">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>{t('dashboard.noFarmsYet') || 'No farms added yet.'}</p>
              <p className="text-xs text-gray-500 mt-2">Click "Add Farm" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {farms.map((farm, index) => (
                <div 
                  key={farm.id}
                  className="p-4 border border-gray-200 rounded-lg bg-gradient-to-br from-white to-gray-50 hover:shadow-lg transition-all duration-300 hover:scale-105 group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm sm:text-base text-gray-800">{farm.name}</h4>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditFarm(farm);
                        }}
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                      >
                        <Edit className="h-3 w-3 text-blue-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingFarm(farm);
                        }}
                        className="h-6 w-6 p-0 hover:bg-red-100"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-xs border">{farm.crop_type}</Badge>
                    <Badge variant="outline" className="text-xs">{farm.soil_type}</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">
                    {t('dashboard.size')}: {farm.size} {farm.unit}
                  </p>
                  {farm.location && (
                    <p className="text-xs text-gray-500 mb-2">
                      📍 {farm.location}
                    </p>
                  )}
                  {farm.sowing_date && (
                    <p className="text-xs text-gray-500 mb-2">
                      🌱 Sown: {new Date(farm.sowing_date).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Added: {new Date(farm.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Farm Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { 
        if (!open) handleCloseDialog(); 
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFarm ? t('dashboard.editFarm') : t('dashboard.addFarm')}
            </DialogTitle>
            <DialogDescription>
              {editingFarm ? 'Update your farm details and location' : 'Add a new farm - all fields are required including location detection and sowing date'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('form.fieldName')} *</Label>
              <Input 
                value={newFarm.name} 
                onChange={(e) => setNewFarm(v => ({ ...v, name: e.target.value }))} 
                placeholder="e.g., North Field" 
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{t('form.fieldSize')} *</Label>
                <Input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  value={newFarm.size} 
                  onChange={(e) => setNewFarm(v => ({ ...v, size: e.target.value }))} 
                  placeholder="0.0" 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t('profile.unit')}</Label>
                <Select value={newFarm.unit} onValueChange={(val) => setNewFarm(v => ({ ...v, unit: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hectares">{t('profile.hectares')}</SelectItem>
                    <SelectItem value="acres">{t('profile.acres')}</SelectItem>
                    <SelectItem value="bigha">{t('profile.bigha')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{t('form.cropType')} *</Label>
                <Select value={newFarm.cropType} onValueChange={(val) => setNewFarm(v => ({ ...v, cropType: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select crop type *" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {getCropTypeOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Soil Type (Auto-detected) *</Label>
                <div className="flex items-center space-x-2">
                  {newFarm.soilData ? (
                    <div className="flex-1 p-2 border rounded-md bg-green-50 border-green-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{LocationSoilService.getSoilTypeEmoji(newFarm.soilType)}</span>
                        <div>
                          <div className="font-medium text-green-800">{newFarm.soilType}</div>
                          <div className="text-xs text-green-600">
                            Confidence: {LocationSoilService.getConfidenceDescription(newFarm.soilData.confidence)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 p-2 border rounded-md bg-gray-50 border-gray-200">
                      <div className="text-gray-500 text-sm">
                        Required: Click "Get Location" to auto-detect soil type
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Location & Soil Detection *</Label>
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGetLocation}
                  disabled={fetchingLocation || saving}
                  className={`w-full flex items-center justify-center space-x-2 h-10 ${!newFarm.soilData ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}
                >
                  {fetchingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  <span>
                    {fetchingLocation ? 'Detecting Location...' : 'Get My Location & Soil Type'}
                  </span>
                </Button>
                
                {newFarm.location && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-blue-800 text-sm">{newFarm.location}</div>
                        {newFarm.coordinates && (
                          <div className="text-xs text-blue-600 mt-1">
                            {newFarm.coordinates.latitude.toFixed(6)}, {newFarm.coordinates.longitude.toFixed(6)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Sowing Date *</Label>
              <Input
                type="date"
                value={newFarm.sowingDate}
                onChange={(e) => setNewFarm(v => ({ ...v, sowingDate: e.target.value }))}
                className="w-full"
                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                required
              />
              <p className="text-xs text-gray-500">
                Required: Select the date when you sowed/planted the crop in this field
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={handleCloseDialog} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveFarm} disabled={saving} className="bg-grass-600 hover:bg-grass-700">
                {saving ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('profile.saving')}
                  </div>
                ) : (
                  editingFarm ? t('dashboard.updateFarm') : t('dashboard.saveFarm')
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingFarm} onOpenChange={() => setDeletingFarm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Farm</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFarm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFarm} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recommendation History */}
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-grass-600" />
            <span>{t('dashboard.recommendationHistory')}</span>
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">{t('dashboard.recommendationHistoryDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {recommendationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-grass-600"></div>
              <span className="ml-2 text-sm">{t('dashboard.loadingRecommendations')}</span>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((recommendation, index) => (
                <div 
                  key={recommendation.id}
                  onClick={() => openFullReport(recommendation)}
                  role="button"
                  className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg bg-gradient-to-r from-white to-gray-50 hover:shadow-md transition-all duration-300 hover:scale-102 cursor-pointer"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-1">
                      <h4 className="font-semibold text-sm sm:text-base text-gray-800">{recommendation.field_name}</h4>
                      <Badge className={`${getStatusColor(recommendation.status)} text-xs w-fit border transition-all duration-200 hover:scale-105`}>
                        {recommendation.status.charAt(0).toUpperCase() + recommendation.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                      {t('dashboard.primary')}: <span className="font-medium">{recommendation.primary_fertilizer}</span>
                      {recommendation.secondary_fertilizer && (
                        <> | {t('dashboard.secondary')}: <span className="font-medium">{recommendation.secondary_fertilizer}</span></>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(recommendation.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Leaf className="h-4 w-4 sm:h-5 sm:w-5 text-grass-600 ml-2 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Leaf className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('dashboard.noRecommendationsYet')}</h3>
              <p className="text-gray-600 text-sm sm:text-base">
                {t('dashboard.startCreatingRecommendations')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ML Model Status */}
      <MLModelStatus />
    </div>
  );
};

export default EnhancedFarmOverview;