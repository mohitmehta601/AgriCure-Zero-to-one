import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  mlApiService,
  FertilizerPredictionInput,
} from "@/services/mlApiService";
import {
  Sparkles,
  Leaf,
  Zap,
  Plus,
  Brain,
  MapPin,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRealTimeData } from "@/contexts/RealTimeDataContext";
import { farmService, Farm } from "@/services/farmService";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCropTypeOptions } from "@/services/fertilizerMLService";
import {
  LocationSoilService,
  type SoilData,
  type LocationData,
} from "@/services/locationSoilService";

interface FormData {
  selectedFarmId: string;
  soilPH: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  temperature: string;
  humidity: string;
  soilMoisture: string;
  mlPrediction?: string;
}

interface EnhancedFertilizerFormProps {
  onSubmit: (data: FormData & { farm: Farm }) => void;
  user?: any;
}

const EnhancedFertilizerForm = ({
  onSubmit,
  user,
}: EnhancedFertilizerFormProps) => {
  const [formData, setFormData] = useState<FormData>({
    selectedFarmId: "",
    soilPH: "",
    nitrogen: "",
    phosphorus: "",
    potassium: "",
    temperature: "",
    humidity: "",
    soilMoisture: "",
  });
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);
  const [newFarm, setNewFarm] = useState({
    name: "",
    size: "",
    unit: "hectares",
    cropType: "",
    soilType: "",
    location: "",
    coordinates: null as LocationData | null,
    soilData: null as SoilData | null,
    sowingDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { realTimeData, isConnected } = useRealTimeData();

  useEffect(() => {
    if (user?.id) {
      loadFarms();
    }
  }, [user]);

  useEffect(() => {
    if (realTimeData) {
      setFormData((prev) => ({
        ...prev,
        soilPH: realTimeData.soilPH.toString(),
        nitrogen: realTimeData.nitrogen.toString(),
        phosphorus: realTimeData.phosphorus.toString(),
        potassium: realTimeData.potassium.toString(),
        temperature: realTimeData.temperature.toString(),
        humidity: realTimeData.humidity.toString(),
        soilMoisture: realTimeData.soilMoisture.toString(),
      }));
    }
  }, [realTimeData]);

  const loadFarms = async () => {
    if (!user?.id) return;

    setFarmsLoading(true);
    try {
      const { data, error } = await farmService.getFarmsByUser(user.id);
      if (error) throw error;
      setFarms(data || []);
    } catch (error) {
      console.error("Error loading farms:", error);
      toast({
        title: t("common.error"),
        description: "Failed to load farms",
        variant: "destructive",
      });
    } finally {
      setFarmsLoading(false);
    }
  };

  const handleFarmSelect = (farmId: string) => {
    const farm = farms.find((f) => f.id === farmId);
    if (farm) {
      setSelectedFarm(farm);
      setFormData((prev) => ({
        ...prev,
        selectedFarmId: farmId,
      }));
    }
  };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAutoFill = () => {
    if (realTimeData) {
      setFormData((prev) => ({
        ...prev,
        soilPH: realTimeData.soilPH.toString(),
        nitrogen: realTimeData.nitrogen.toString(),
        phosphorus: realTimeData.phosphorus.toString(),
        potassium: realTimeData.potassium.toString(),
        temperature: realTimeData.temperature.toString(),
        humidity: realTimeData.humidity.toString(),
        soilMoisture: realTimeData.soilMoisture.toString(),
      }));

      toast({
        title: t("form.autoFilled"),
        description: t("form.formFilledWithSensorData"),
      });
    } else {
      toast({
        title: t("form.noDataAvailable"),
        description: t("form.realTimeSensorDataNotAvailable"),
        variant: "destructive",
      });
    }
  };

  const handleGetLocation = async () => {
    setFetchingLocation(true);
    try {
      const { location, soilData, locationString } =
        await LocationSoilService.getLocationAndSoilData();

      setNewFarm((prev) => ({
        ...prev,
        coordinates: location,
        location: locationString,
        soilType: soilData.soil_type,
        soilData: soilData,
      }));

      toast({
        title: t("common.success"),
        description: `Soil type detected: ${
          soilData.soil_type
        } (${LocationSoilService.getConfidenceDescription(
          soilData.confidence
        )})`,
      });
    } catch (error) {
      console.error("Error getting location:", error);
      toast({
        title: t("common.error"),
        description: "Failed to get location. Please enter manually.",
        variant: "destructive",
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleAddFarm = async () => {
    if (!user?.id) return;

    const sizeNum = parseFloat(newFarm.size);
    if (
      !newFarm.name ||
      isNaN(sizeNum) ||
      !newFarm.cropType ||
      !newFarm.soilType ||
      !newFarm.soilData
    ) {
      toast({
        title: t("common.error"),
        description:
          "Please fill in all required fields and detect your location to get soil type",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const farmData = {
        user_id: user.id,
        name: newFarm.name,
        size: sizeNum,
        unit: newFarm.unit as any,
        crop_type: newFarm.cropType,
        soil_type: newFarm.soilType,
        location: newFarm.location || undefined,
        sowing_date: newFarm.sowingDate || undefined,
      };

      const { data, error } = await farmService.createFarm(farmData);
      if (error) throw error;

      toast({
        title: t("common.success"),
        description: "Farm added successfully",
      });

      await loadFarms();
      setIsAddFarmOpen(false);
      setNewFarm({
        name: "",
        size: "",
        unit: "hectares",
        cropType: "",
        soilType: "",
        location: "",
        coordinates: null,
        soilData: null,
        sowingDate: "",
      });

      if (data) {
        handleFarmSelect(data.id);
      }
    } catch (error) {
      console.error("Error adding farm:", error);
      toast({
        title: t("common.error"),
        description: "Failed to add farm",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFarm) {
      toast({
        title: t("common.error"),
        description: "Please select a farm first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const mlInput: FertilizerPredictionInput = {
        Temperature: parseFloat(formData.temperature),
        Humidity: parseFloat(formData.humidity),
        Moisture: parseFloat(formData.soilMoisture),
        Soil_Type: selectedFarm.soil_type,
        Crop_Type: selectedFarm.crop_type,
        Nitrogen: parseFloat(formData.nitrogen),
        Potassium: parseFloat(formData.potassium),
        Phosphorous: parseFloat(formData.phosphorus),
      };

      const validation = mlApiService.validateInput(mlInput);
      if (!validation.isValid) {
        toast({
          title: "Validation Error",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const prediction = await mlApiService.getPrediction(mlInput);

      const enhancedData = {
        ...formData,
        mlPrediction: prediction.fertilizer,
        farm: selectedFarm,
      };

      onSubmit(enhancedData);

      toast({
        title: "AI Analysis Complete!",
        description: `Recommended fertilizer: ${prediction.fertilizer}`,
      });
    } catch (error) {
      console.error("ML prediction failed:", error);
      toast({
        title: "AI Prediction Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to get fertilizer recommendation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cropOptions = getCropTypeOptions();

  return (
    <>
      <Card className="w-full border-0 shadow-xl bg-gradient-to-br from-white to-gray-50 hover:shadow-2xl transition-all duration-500">
        <CardHeader className="px-4 sm:px-6 bg-gradient-to-r from-grass-50 to-green-50 rounded-t-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div>
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl text-grass-800">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-grass-600 animate-pulse" />
                <span>{t("dashboard.fertilizerForm")}</span>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 ">
                  <Brain className="h-3 w-3 mr-1" />
                  ML-Powered
                </Badge>
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-grass-700">
                Select your farm and get ML-powered fertilizer recommendations
                based on real-time data
              </CardDescription>
            </div>
            <Button
              onClick={handleAutoFill}
              variant="outline"
              size="sm"
              disabled={!isConnected || !realTimeData}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 text-blue-700 hover:text-blue-800 transition-all duration-300"
            >
              <Zap className="h-4 w-4 mr-2" />
              {isConnected
                ? t("form.autoFillWithSensorData")
                : t("form.sensorDataUnavailable")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Farm Selection */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center space-x-2">
                <Leaf className="h-4 w-4 sm:h-5 sm:w-5 text-grass-600" />
                <span>Farm Selection</span>
              </h3>
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <Label
                    htmlFor="farmSelect"
                    className="text-sm sm:text-base font-medium text-gray-700"
                  >
                    Select Farm *
                  </Label>
                  <Select
                    onValueChange={handleFarmSelect}
                    value={formData.selectedFarmId}
                    disabled={farmsLoading}
                  >
                    <SelectTrigger className="transition-all duration-300 focus:ring-2 focus:ring-grass-500 focus:border-grass-500 hover:border-grass-300">
                      <SelectValue
                        placeholder={
                          farmsLoading ? "Loading farms..." : "Choose a farm"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {farms.map((farm) => (
                        <SelectItem
                          key={farm.id}
                          value={farm.id}
                          className="hover:bg-grass-50 transition-colors duration-200"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{farm.name}</span>
                            <span className="text-xs text-gray-500">
                              {farm.size} {farm.unit} • {farm.crop_type} •{" "}
                              {farm.soil_type}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={() => setIsAddFarmOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mt-6 bg-grass-50 border-grass-200 hover:bg-grass-100 text-grass-700 hover:text-grass-800 transition-all duration-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Farm
                </Button>
              </div>

              {selectedFarm && (
                <div className="p-4 bg-gradient-to-r from-grass-50 to-green-50 rounded-lg border border-grass-200">
                  <h4 className="font-semibold text-grass-800 mb-2">
                    Selected Farm Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Size:</span>
                      <span className="ml-1 font-medium">
                        {selectedFarm.size} {selectedFarm.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Crop:</span>
                      <span className="ml-1 font-medium">
                        {selectedFarm.crop_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Soil:</span>
                      <span className="ml-1 font-medium">
                        {selectedFarm.soil_type}
                      </span>
                    </div>
                    {selectedFarm.sowing_date && (
                      <div>
                        <span className="text-gray-600">🌱 Sowing Date:</span>
                        <span className="ml-1 font-medium">
                          {new Date(
                            selectedFarm.sowing_date
                          ).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Soil Chemistry */}
            <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <h3 className="text-base sm:text-lg font-semibold text-blue-800">
                Soil Chemistry
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="soilPH"
                    className="text-sm sm:text-base font-medium text-blue-700"
                  >
                    Soil pH *
                  </Label>
                  <Input
                    id="soilPH"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="e.g., 6.5"
                    value={formData.soilPH}
                    onChange={(e) => handleChange("soilPH", e.target.value)}
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="nitrogen"
                    className="text-sm sm:text-base font-medium text-blue-700"
                  >
                    Nitrogen (mg/kg) *
                  </Label>
                  <Input
                    id="nitrogen"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 45.2"
                    value={formData.nitrogen}
                    onChange={(e) => handleChange("nitrogen", e.target.value)}
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="phosphorus"
                    className="text-sm sm:text-base font-medium text-blue-700"
                  >
                    Phosphorus (mg/kg) *
                  </Label>
                  <Input
                    id="phosphorus"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 23.8"
                    value={formData.phosphorus}
                    onChange={(e) => handleChange("phosphorus", e.target.value)}
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="potassium"
                    className="text-sm sm:text-base font-medium text-blue-700"
                  >
                    Potassium (mg/kg) *
                  </Label>
                  <Input
                    id="potassium"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 156.4"
                    value={formData.potassium}
                    onChange={(e) => handleChange("potassium", e.target.value)}
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300"
                  />
                </div>
              </div>
            </div>

            {/* Environmental Conditions */}
            <div className="space-y-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
              <h3 className="text-base sm:text-lg font-semibold text-orange-800">
                {t("form.environmentalConditions")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="temperature"
                    className="text-sm sm:text-base font-medium text-orange-700"
                  >
                    {t("form.temperature")} (°C) *
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 24.3"
                    value={formData.temperature}
                    onChange={(e) =>
                      handleChange("temperature", e.target.value)
                    }
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="humidity"
                    className="text-sm sm:text-base font-medium text-orange-700"
                  >
                    {t("form.humidity")} (%) *
                  </Label>
                  <Input
                    id="humidity"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g., 72.1"
                    value={formData.humidity}
                    onChange={(e) => handleChange("humidity", e.target.value)}
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="soilMoisture"
                    className="text-sm sm:text-base font-medium text-orange-700"
                  >
                    {t("form.soilMoisture")} (%) *
                  </Label>
                  <Input
                    id="soilMoisture"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g., 68.5"
                    value={formData.soilMoisture}
                    onChange={(e) =>
                      handleChange("soilMoisture", e.target.value)
                    }
                    required
                    className="transition-all duration-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-grass-600 to-green-600 hover:from-grass-700 hover:to-green-700 text-sm sm:text-base py-2 sm:py-3 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                disabled={isLoading || !selectedFarm}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Getting AI Recommendations...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Brain className="h-4 w-4" />
                    <span>Get ML Recommendations</span>
                  </div>
                )}
              </Button>
              <Button
                type="reset"
                variant="outline"
                className="flex-1 sm:flex-none text-sm sm:text-base py-2 sm:py-3 transition-all duration-300 hover:scale-105 border-grass-300 hover:bg-grass-50"
                onClick={() =>
                  setFormData({
                    selectedFarmId: "",
                    soilPH: "",
                    nitrogen: "",
                    phosphorus: "",
                    potassium: "",
                    temperature: "",
                    humidity: "",
                    soilMoisture: "",
                  })
                }
              >
                {t("form.reset")}
              </Button>
            </div>

            {!selectedFarm && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Please select a farm first to get ML-powered recommendations
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Add Farm Dialog */}
      <Dialog open={isAddFarmOpen} onOpenChange={setIsAddFarmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Farm</DialogTitle>
            <DialogDescription>
              Add a new farm - all fields are required including location
              detection and sowing date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{t("form.fieldName")} *</Label>
              <Input
                value={newFarm.name}
                onChange={(e) =>
                  setNewFarm((v) => ({ ...v, name: e.target.value }))
                }
                placeholder="e.g., North Field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{t("form.fieldSize")} *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newFarm.size}
                  onChange={(e) =>
                    setNewFarm((v) => ({ ...v, size: e.target.value }))
                  }
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t("profile.unit")}</Label>
                <Select
                  value={newFarm.unit}
                  onValueChange={(val) =>
                    setNewFarm((v) => ({ ...v, unit: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hectares">
                      {t("profile.hectares")}
                    </SelectItem>
                    <SelectItem value="acres">{t("profile.acres")}</SelectItem>
                    <SelectItem value="bigha">{t("profile.bigha")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{t("form.cropType")} *</Label>
                <Select
                  value={newFarm.cropType}
                  onValueChange={(val) =>
                    setNewFarm((v) => ({ ...v, cropType: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("form.cropType")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {cropOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
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
                        <span className="text-lg">
                          {LocationSoilService.getSoilTypeEmoji(
                            newFarm.soilType
                          )}
                        </span>
                        <div>
                          <div className="font-medium text-green-800">
                            {newFarm.soilType}
                          </div>
                          <div className="text-xs text-green-600">
                            Confidence:{" "}
                            {LocationSoilService.getConfidenceDescription(
                              newFarm.soilData.confidence
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 p-2 border rounded-md bg-gray-50 border-gray-200">
                      <div className="text-gray-500 text-sm">
                        Click "Get Location" to auto-detect soil type
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Location & Soil Detection *</Label>
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={fetchingLocation || saving}
                className="w-full flex items-center justify-center space-x-2 h-10"
              >
                {fetchingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                <span>
                  {fetchingLocation
                    ? "Detecting Location..."
                    : "Get My Location & Soil Type"}
                </span>
              </Button>

              {newFarm.location && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-blue-800 text-sm">
                        {newFarm.location}
                      </div>
                      {newFarm.coordinates && (
                        <div className="text-xs text-blue-600 mt-1">
                          {newFarm.coordinates.latitude.toFixed(6)},{" "}
                          {newFarm.coordinates.longitude.toFixed(6)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Sowing Date *</Label>
              <Input
                type="date"
                value={newFarm.sowingDate}
                onChange={(e) =>
                  setNewFarm((v) => ({ ...v, sowingDate: e.target.value }))
                }
                className="w-full"
                max={new Date().toISOString().split("T")[0]} // Prevent future dates
              />
              <p className="text-xs text-gray-500">
                Select the date when you sowed/planted the crop
              </p>
            </div>

            <div className="space-y-3">
              {(!newFarm.name ||
                !newFarm.size ||
                !newFarm.cropType ||
                !newFarm.soilData) && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                  ⚠️ Please fill in all required fields and detect your location
                  to enable saving
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setIsAddFarmOpen(false)}
                  disabled={saving}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleAddFarm}
                  disabled={
                    saving ||
                    !newFarm.name ||
                    !newFarm.size ||
                    !newFarm.cropType ||
                    !newFarm.soilData
                  }
                  className="bg-grass-600 hover:bg-grass-700"
                >
                  {saving ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t("profile.saving")}
                    </div>
                  ) : (
                    t("dashboard.saveFarm") || "Save Farm"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedFertilizerForm;